"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch, getRole } from "../../lib/api";
import { translateApiError } from "../../lib/errors";
import type { Lead, LeadStatus } from "../../lib/types";
import {
  formatDate,
  formatPrice,
  leadKindLabel,
  leadSourceLabel,
  normalizeSearch,
  pluralRu,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
} from "../../lib/labels";
import { notifyLeadsChanged } from "../../lib/useNewLeadsCount";
import { useToast } from "../../lib/useToast";
import { useUnsavedGuard, UNSAVED_MESSAGE } from "../../lib/useUnsavedGuard";
import Toast from "../../components/Toast";

type StatusFilter = "" | LeadStatus;

// UTM-ключи по-русски; незнакомые ключи выводятся как есть.
const UTM_LABELS: Record<string, string> = {
  utm_source: "Источник",
  utm_medium: "Канал",
  utm_campaign: "Кампания",
  utm_content: "Объявление",
  utm_term: "Ключ",
};

// Только цифры телефона — для поиска и ссылок tel:/wa.me.
function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Цифры для wa.me: 8XXXXXXXXXX (11) → 7XXXXXXXXXX.
function waDigits(phone: string): string {
  const d = phoneDigits(phone);
  if (d.length === 11 && d.startsWith("8")) return "7" + d.slice(1);
  return d;
}

// Валидный статус из query-строки.
function parseStatus(v: string | null): StatusFilter {
  return v === "new" || v === "in_progress" || v === "done" ? v : "";
}

// Бейдж «новых: N» в сайдбаре слушает это событие (см. useNewLeadsCount)
// и обновляется сразу, не дожидаясь минутного опроса.

// ── CSV (клиентская выгрузка видимого списка) ────────────────────────
// Дата для CSV: локальное время «ДД.ММ.ГГГГ ЧЧ:ММ».
function csvDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Ячейка CSV: защита от formula injection (=, +, -, @ — данные посетителей)
// + экранирование кавычек/разделителей/переводов строк.
function csvCell(value: string): string {
  let s = value;
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// UTM-словарь → строка «k=v; k=v»; вложенные объекты/массивы — JSON.
function csvUtm(utm: Record<string, unknown> | null): string {
  if (!utm) return "";
  return Object.entries(utm)
    .map(
      ([k, v]) =>
        `${k}=${
          v !== null && typeof v === "object" ? JSON.stringify(v) : String(v ?? "")
        }`
    )
    .join("; ");
}

export default function LeadsPage() {
  const { msg, show } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Deep-links: ?status=, ?lead=, ?denied=1 — читаем один раз на маунте.
  // Одноразовые параметры (?lead=, ?denied=) сразу убираем из адреса,
  // чтобы F5/копирование ссылки не воспроизводили их повторно.
  useEffect(() => {
    setIsAdmin(getRole() === "admin");
    const params = new URLSearchParams(window.location.search);
    setFilter(parseStatus(params.get("status")));
    const lead = params.get("lead");
    if (lead) {
      setPendingLeadId(lead);
      params.delete("lead");
    }
    if (params.get("denied") === "1") {
      show("Раздел доступен только суперадмину", "error");
      params.delete("denied");
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
    setInitialized(true);
    // show стабилен (useCallback в useToast)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const q = status ? `?status=${status}` : "";
      const data = await apiFetch<Lead[]>(`/api/v1/admin/leads${q}`);
      setLeads(data);
    } catch (err) {
      setError(translateApiError(err, "Ошибка загрузки"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Смена фильтра статуса: state + зеркалирование в URL (F5 и ссылка
  // коллеге сохраняют текущий вид).
  function applyFilter(next: StatusFilter) {
    setFilter(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("status", next);
    else params.delete("status");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "")
    );
  }

  useEffect(() => {
    if (!initialized) return;
    load(filter);
  }, [filter, load, initialized]);

  // ?lead= — открыть заявку: из списка или дозапросом (не в текущем фильтре).
  useEffect(() => {
    if (!pendingLeadId || loading) return;
    const found = leads.find((l) => l.id === pendingLeadId);
    if (found) {
      setSelected(found);
      setPendingLeadId(null);
      return;
    }
    let cancelled = false;
    apiFetch<Lead>(`/api/v1/admin/leads/${pendingLeadId}`)
      .then((lead) => {
        if (!cancelled) setSelected(lead);
      })
      .catch(() => {
        if (!cancelled) show("Заявка не найдена", "error");
      })
      .finally(() => {
        if (!cancelled) setPendingLeadId(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLeadId, loading, leads]);

  // Клиентский поиск (имя/телефон) + фильтр дат.
  const visible = useMemo(() => {
    let list = leads;
    // «ё» ≡ «е» — та же нормализация, что и в списках разделов
    const q = normalizeSearch(query.trim());
    if (q) {
      const qDigits = q.replace(/\D/g, "");
      list = list.filter((l) => {
        const byName = normalizeSearch(l.name).includes(q);
        // Телефон ищем в обоих вариантах кода страны: бэкенд хранит
        // +7XXXXXXXXXX, а менеджеры часто набирают номер с привычной «8».
        const pd = phoneDigits(l.phone);
        const pd8 = pd.startsWith("7") ? "8" + pd.slice(1) : pd;
        const byPhone =
          qDigits.length > 0 &&
          (pd.includes(qDigits) || pd8.includes(qDigits));
        return byName || byPhone;
      });
    }
    if (dateFrom) {
      const from = new Date(dateFrom + "T00:00:00");
      list = list.filter((l) => new Date(l.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59.999");
      list = list.filter((l) => new Date(l.created_at) <= to);
    }
    return list;
  }, [leads, query, dateFrom, dateTo]);

  // Обновление одной заявки в списке и в открытой панели.
  function applyUpdate(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
  }

  async function changeStatus(lead: Lead, status: LeadStatus) {
    try {
      const updated = await apiFetch<Lead>(`/api/v1/admin/leads/${lead.id}`, {
        method: "PATCH",
        body: { status },
      });
      applyUpdate(updated);
      show("Статус обновлён");
      notifyLeadsChanged();
      // Если активен фильтр и статус больше не подходит — убираем строку.
      if (filter && updated.status !== filter) {
        setLeads((prev) => prev.filter((l) => l.id !== updated.id));
      }
    } catch (err) {
      show(translateApiError(err, "Ошибка"), "error");
    }
  }

  // Экспорт в CSV: файл собирается на клиенте из ВИДИМОГО списка —
  // ровно те строки, что на экране (статус + поиск + даты). Формат как у
  // серверной выгрузки: BOM + разделитель «;» для корректного Excel.
  function exportCsv() {
    const header = [
      "Дата",
      "Имя",
      "Телефон",
      "Тип",
      "Статус",
      "Блок",
      "Кнопка",
      "UTM",
      "Заметки",
    ];
    const rows = visible.map((l) =>
      [
        csvDate(l.created_at),
        l.name,
        l.phone,
        l.kind,
        l.status,
        l.source_block ?? "",
        l.source_button ?? "",
        csvUtm(l.utm),
        l.notes ?? "",
      ]
        .map(csvCell)
        .join(";")
    );
    const csv = "\u{FEFF}" + [header.join(";"), ...rows].join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `leads_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    const n = visible.length;
    show(`Файл выгружен — ${n} ${pluralRu(n, "заявка", "заявки", "заявок")}`);
  }

  // Удаление заявки (право на удаление ПДн, 152-ФЗ) — только для admin.
  async function deleteLead(lead: Lead) {
    if (
      !window.confirm(`Удалить заявку «${lead.name}»? Действие необратимо.`)
    ) {
      return;
    }
    try {
      await apiFetch<void>(`/api/v1/admin/leads/${lead.id}`, {
        method: "DELETE",
      });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setSelected((prev) => (prev && prev.id === lead.id ? null : prev));
      show("Заявка удалена");
      notifyLeadsChanged();
    } catch (err) {
      show(translateApiError(err, "Ошибка удаления"), "error");
    }
  }

  // prev/next в панели — по текущему видимому списку.
  const selectedIndex = selected
    ? visible.findIndex((l) => l.id === selected.id)
    : -1;

  // Соседи открытой заявки запоминаются, пока она есть в списке: если смена
  // статуса при активном фильтре убрала строку, панель остаётся открытой,
  // а ←/→ продолжают вести к бывшим соседям (если те ещё видимы).
  const neighborsRef = useRef<{
    id: string | null;
    prev: Lead | null;
    next: Lead | null;
  }>({ id: null, prev: null, next: null });
  useEffect(() => {
    if (selected && selectedIndex >= 0) {
      neighborsRef.current = {
        id: selected.id,
        prev: selectedIndex > 0 ? visible[selectedIndex - 1] : null,
        next:
          selectedIndex < visible.length - 1
            ? visible[selectedIndex + 1]
            : null,
      };
    }
  }, [selected, selectedIndex, visible]);

  const stillVisible = (l: Lead | null): Lead | null =>
    l && visible.some((x) => x.id === l.id) ? l : null;
  const fallbackOk =
    selected !== null &&
    selectedIndex === -1 &&
    neighborsRef.current.id === selected.id;
  const prevLead =
    selectedIndex > 0
      ? visible[selectedIndex - 1]
      : fallbackOk
      ? stillVisible(neighborsRef.current.prev)
      : null;
  const nextLead =
    selectedIndex >= 0
      ? selectedIndex < visible.length - 1
        ? visible[selectedIndex + 1]
        : null
      : fallbackOk
      ? stillVisible(neighborsRef.current.next)
      : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Заявки</h1>
          <p className="page-desc">
            Обращения с форм сайта: обратные звонки, запросы презентации и
            расчёты рассрочки.
          </p>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-sm"
          onClick={exportCsv}
          disabled={loading || visible.length === 0}
          title="Выгрузить в CSV строки, видимые в таблице (с учётом фильтров)"
        >
          Экспорт CSV
        </button>
      </div>

      <div className="leads-filters">
        <input
          type="search"
          className="input list-search"
          placeholder="Имя или телефон…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Поиск по имени или телефону"
        />
        <label className="leads-filter-label" htmlFor="status-filter">
          Статус
        </label>
        <select
          id="status-filter"
          className="select"
          style={{ width: "auto" }}
          value={filter}
          onChange={(e) => applyFilter(e.target.value as StatusFilter)}
        >
          <option value="">Все</option>
          {LEAD_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="leads-filter-label" htmlFor="date-from">
          С
        </label>
        <input
          id="date-from"
          type="date"
          className="input"
          style={{ width: "auto" }}
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <label className="leads-filter-label" htmlFor="date-to">
          По
        </label>
        <input
          id="date-to"
          type="date"
          className="input"
          style={{ width: "auto" }}
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
        />
        {(query || dateFrom || dateTo) && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setQuery("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Сбросить
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          {error}{" "}
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: "var(--sp-2)" }}
            onClick={() => void load(filter)}
          >
            Повторить
          </button>
        </div>
      )}

      {loading ? (
        <div className="row-gap" style={{ color: "var(--ink-45)" }}>
          <span className="spin" /> Загрузка…
        </div>
      ) : error ? null : leads.length === 0 ? (
        <div className="alert alert-info">Заявок нет</div>
      ) : visible.length === 0 ? (
        <div className="alert alert-info">
          По заданным условиям заявок не найдено
        </div>
      ) : (
        <>
          <div className="muted list-count" style={{ marginBottom: "var(--sp-3)" }}>
            Всего: {leads.length}
            {visible.length !== leads.length
              ? ` · показано ${visible.length}`
              : ""}
          </div>
          <div className="table-wrap">
            <table className="data leads-table">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Телефон</th>
                  <th>Тип</th>
                  <th>Блок-источник</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => (
                  <tr
                    key={lead.id}
                    className="clickable"
                    onClick={() => setSelected(lead)}
                  >
                    <td data-label="Имя">{lead.name}</td>
                    <td data-label="Телефон" className="mono">
                      {lead.phone}
                    </td>
                    <td data-label="Тип">{leadKindLabel(lead.kind)}</td>
                    <td data-label="Блок">{leadSourceLabel(lead.source_block)}</td>
                    <td data-label="Статус" onClick={(e) => e.stopPropagation()}>
                      <select
                        className="select"
                        style={{ width: "auto" }}
                        value={lead.status}
                        onChange={(e) =>
                          changeStatus(lead, e.target.value as LeadStatus)
                        }
                      >
                        {LEAD_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {LEAD_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Дата" className="muted nowrap">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <LeadDrawer
          lead={selected}
          canDelete={isAdmin}
          isAdmin={isAdmin}
          prev={prevLead}
          next={nextLead}
          onStatusChange={changeStatus}
          onNavigate={(l) => setSelected(l)}
          onClose={() => setSelected(null)}
          onSaved={(u) => {
            applyUpdate(u);
            show("Заявка сохранена");
          }}
          onDelete={deleteLead}
          onError={(m) => show(m, "error")}
        />
      )}

      <Toast msg={msg} />
    </div>
  );
}

// ── Снимок расчёта рассрочки ──────────────────────────────────────────
// Распознанный контракт {input, result} → читаемый dl.kv;
// незнакомый shape — прежний JSON-фолбэк.
function CalcSnapshotView({
  snapshot,
}: {
  snapshot: Record<string, unknown> | null;
}) {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return <pre className="code">—</pre>;
  }

  const result = snapshot.result as Record<string, unknown> | undefined;
  const price = typeof result?.price === "number" ? result.price : null;
  const monthly =
    typeof result?.monthly_payment === "number" ? result.monthly_payment : null;

  if (price === null || monthly === null) {
    return <pre className="code">{JSON.stringify(snapshot, null, 2)}</pre>;
  }

  const numOr = (v: unknown): number | null =>
    typeof v === "number" ? v : null;
  const down = numOr(result?.down_payment);
  const downPct = numOr(result?.down_payment_pct);
  const months = numOr(result?.months);
  const markup = numOr(result?.markup);
  const total = numOr(result?.total_cost);

  return (
    <dl className="kv" style={{ margin: 0 }}>
      <dt>Стоимость лота</dt>
      <dd className="mono">{formatPrice(Math.round(price))}</dd>
      <dt>Первый взнос</dt>
      <dd className="mono">
        {down !== null ? formatPrice(Math.round(down)) : "—"}
        {downPct !== null ? ` (${Math.round(downPct * 100)} %)` : ""}
      </dd>
      <dt>Срок</dt>
      <dd>{months !== null ? `${months} мес.` : "—"}</dd>
      <dt>Платёж в месяц</dt>
      <dd className="mono">{formatPrice(Math.round(monthly))}</dd>
      <dt>Удорожание</dt>
      <dd className="mono">
        {markup !== null ? formatPrice(Math.round(markup)) : "—"}
      </dd>
      <dt>Итого</dt>
      <dd className="mono">
        {total !== null ? formatPrice(Math.round(total)) : "—"}
      </dd>
    </dl>
  );
}

// ── UTM-метки по-русски ───────────────────────────────────────────────
function UtmView({ utm }: { utm: Record<string, unknown> | null }) {
  if (!utm || Object.keys(utm).length === 0) {
    return <pre className="code">—</pre>;
  }
  return (
    <dl className="kv" style={{ margin: 0 }}>
      {Object.entries(utm).map(([key, value]) => (
        <span key={key} style={{ display: "contents" }}>
          <dt>{UTM_LABELS[key] ?? key}</dt>
          <dd className="mono">
            {value === null || value === undefined
              ? "—"
              : typeof value === "object"
              ? // Повторный параметр (массив) или вложенный объект —
                // показываем как JSON, а не «[object Object]».
                JSON.stringify(value)
              : String(value)}
          </dd>
        </span>
      ))}
    </dl>
  );
}

// ── Панель деталей заявки ─────────────────────────────────────────────
function LeadDrawer({
  lead,
  canDelete,
  isAdmin,
  prev,
  next,
  onStatusChange,
  onNavigate,
  onClose,
  onSaved,
  onDelete,
  onError,
}: {
  lead: Lead;
  canDelete: boolean;
  isAdmin: boolean;
  prev: Lead | null;
  next: Lead | null;
  onStatusChange: (l: Lead, status: LeadStatus) => void;
  onNavigate: (l: Lead) => void;
  onClose: () => void;
  onSaved: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onError: (msg: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [saving, setSaving] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  // Синхронизируем поле при смене выбранной заявки.
  useEffect(() => {
    setNotes(lead.notes || "");
  }, [lead.id, lead.notes]);

  // ←/→ переиспользуют смонтированную панель — скролл к шапке новой заявки.
  useEffect(() => {
    asideRef.current?.scrollTo(0, 0);
  }, [lead.id]);

  // Модальная панель: блокируем прокрутку фона (иначе под оверлеем «уезжает»
  // список) и уводим фокус внутрь — Tab не должен ходить по скрытой таблице.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    asideRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const notesDirty = notes !== (lead.notes || "");
  useUnsavedGuard(notesDirty && !saving);

  // Закрытие/переключение при несохранённой заметке — confirm.
  function guarded(action: () => void) {
    if (notesDirty && !window.confirm(UNSAVED_MESSAGE)) return;
    action();
  }

  // Escape закрывает панель — как в медиабиблиотеке.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guarded(onClose);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function saveNotes() {
    setSaving(true);
    try {
      const updated = await apiFetch<Lead>(`/api/v1/admin/leads/${lead.id}`, {
        method: "PATCH",
        body: { notes },
      });
      onSaved(updated);
    } catch (err) {
      onError(translateApiError(err, "Ошибка сохранения"));
    } finally {
      setSaving(false);
    }
  }

  const wa = waDigits(lead.phone);

  return (
    <>
      <div className="overlay" onClick={() => guarded(onClose)} />
      <aside
        ref={asideRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Детали заявки"
        tabIndex={-1}
      >
        <div className="page-head">
          <h2 style={{ fontSize: "1.25rem" }}>{lead.name}</h2>
          <div className="spacer" />
          <div className="row-gap" style={{ flexWrap: "nowrap" }}>
            <button
              className="btn btn-sm"
              disabled={!prev}
              title="Предыдущая заявка"
              onClick={() => prev && guarded(() => onNavigate(prev))}
            >
              ←
            </button>
            <button
              className="btn btn-sm"
              disabled={!next}
              title="Следующая заявка"
              onClick={() => next && guarded(() => onNavigate(next))}
            >
              →
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => guarded(onClose)}
            >
              Закрыть
            </button>
          </div>
        </div>

        <dl className="kv">
          <dt>Телефон</dt>
          <dd className="mono">
            <a href={`tel:+${waDigits(lead.phone)}`}>{lead.phone}</a>
            {wa.length >= 10 && (
              <>
                {" · "}
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </>
            )}
          </dd>
          <dt>Тип</dt>
          <dd>{leadKindLabel(lead.kind)}</dd>
          <dt>Статус</dt>
          <dd>
            {/* Статус меняется прямо из панели: workflow «позвонил → записал
                → отметил обработанной» без возврата к таблице */}
            <select
              className="select"
              style={{ width: "auto" }}
              value={lead.status}
              aria-label="Статус заявки"
              onChange={(e) =>
                onStatusChange(lead, e.target.value as LeadStatus)
              }
            >
              {LEAD_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </dd>
          <dt>Создана</dt>
          <dd>{formatDate(lead.created_at)}</dd>
          <dt>Согласие</dt>
          <dd>
            {lead.consent_given ? "Да" : "Нет"}
            {lead.consent_at ? ` · ${formatDate(lead.consent_at)}` : ""}
          </dd>
          <dt>Сообщение</dt>
          <dd>{lead.message || "—"}</dd>
          <dt>Кнопка</dt>
          <dd>{lead.source_button || "—"}</dd>
          <dt>Блок</dt>
          <dd>{leadSourceLabel(lead.source_block)}</dd>
          <dt>Страница</dt>
          <dd>{lead.page_url || "—"}</dd>
          <dt>IP</dt>
          <dd className="mono">{lead.ip_address || "—"}</dd>
          <dt>Планировка</dt>
          <dd>
            {lead.floorplan_id ? (
              isAdmin ? (
                <Link href={`/floorplans/${lead.floorplan_id}`}>
                  {lead.floorplan_title || "Открыть планировку"}
                </Link>
              ) : (
                lead.floorplan_title || "—"
              )
            ) : (
              "—"
            )}
          </dd>
        </dl>

        <div className="field">
          <div className="field-label">UTM-метки</div>
          <UtmView utm={lead.utm} />
        </div>

        <div className="field">
          <div className="field-label">Расчёт рассрочки</div>
          <CalcSnapshotView snapshot={lead.calc_snapshot} />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="notes">
            Заметки менеджера
          </label>
          <textarea
            id="notes"
            className="textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Комментарий, договорённости, итог звонка…"
          />
        </div>

        <div className="row-gap" style={{ marginTop: "var(--sp-4)" }}>
          <button
            className="btn btn-primary"
            onClick={saveNotes}
            disabled={saving || !notesDirty}
          >
            {saving ? "Сохранение…" : "Сохранить заметки"}
          </button>
          {canDelete && (
            <button
              className="btn btn-danger"
              onClick={() => onDelete(lead)}
              title="Удалить заявку и персональные данные (152-ФЗ)"
            >
              Удалить
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
