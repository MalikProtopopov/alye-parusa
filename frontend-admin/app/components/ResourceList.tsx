"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { translateApiError } from "../lib/errors";
import { formatDate, normalizeSearch as normalize } from "../lib/labels";
import { mediaUrl } from "../lib/media";
import type {
  ColumnDef,
  ResourceConfig,
  ResourceItem,
} from "../lib/resources";
import { useToast } from "../lib/useToast";
import { ExternalLinkIcon, Icon, PencilIcon, TrashIcon } from "./icons";
import Toast from "./Toast";

// Подпись иконочного действия для скринридера: два десятка «Изменить»
// подряд на слух неразличимы — добавляем название записи. В title
// (визуальная подсказка мышью) остаётся короткий текст.
function actionLabel(
  action: string,
  item: ResourceItem,
  config: ResourceConfig
): string {
  const name = String(item[config.nameField] ?? "").trim();
  return name ? `${action} «${name}»` : action;
}

function cellClass(c: ColumnDef): string | undefined {
  if (c.kind === "mono") return "mono muted";
  if (c.kind === "muted") return "muted";
  return undefined;
}

// Тумблер «активна»: оптимистичный PUT {active}, откат при ошибке.
function ToggleCell({
  item,
  colKey,
  onToggle,
}: {
  item: ResourceItem;
  colKey: string;
  onToggle: (item: ResourceItem, next: boolean) => void;
}) {
  const on = Boolean(item[colKey]);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Выключить" : "Включить"}
      className={"switch" + (on ? " on" : "")}
      onClick={() => onToggle(item, !on)}
    >
      <span className="switch-knob" />
    </button>
  );
}

function renderCell(
  c: ColumnDef,
  item: ResourceItem,
  config: ResourceConfig,
  onToggle: (item: ResourceItem, next: boolean) => void,
  brokenImages: Set<string>,
  markBroken: (url: string) => void
) {
  if (c.kind === "toggle") {
    return <ToggleCell item={item} colKey={c.key} onToggle={onToggle} />;
  }
  if (c.render) {
    const custom = c.render(item);
    if (c.primary) {
      return <Link href={`${config.route}/${item.id}`}>{custom}</Link>;
    }
    return custom;
  }

  const raw = item[c.key];

  if (c.kind === "image") {
    // В API лежит относительный путь /media/<файл> — дописываем домен API,
    // иначе браузер искал бы файл на домене админки и рисовал «битую» иконку.
    const url = mediaUrl(typeof raw === "string" ? raw : "");
    const filled = url !== null;
    // Битый URL — не «сломанная» иконка браузера, а обычный плейсхолдер.
    return url && !brokenImages.has(url) ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="list-thumb"
        src={url}
        alt=""
        loading="lazy"
        onError={() => markBroken(url)}
      />
    ) : (
      // Аккуратная плашка с иконкой картинки: и «фото не задано», и
      // «файл не найден» выглядят как осознанное состояние, а не пустота.
      <span
        className="list-thumb list-thumb-empty"
        role="img"
        aria-label={filled ? "Файл не найден" : "Изображение не задано"}
        title={
          filled
            ? "Файл не найден — замените изображение в записи"
            : "Изображение не задано"
        }
      >
        <Icon name="banner" width={20} height={20} />
      </span>
    );
  }
  if (c.primary) {
    let text =
      raw === null || raw === undefined || raw === "" ? "—" : String(raw);
    if (c.kind === "map") text = c.map?.[text] ?? text;
    return <Link href={`${config.route}/${item.id}`}>{text}</Link>;
  }
  if (c.kind === "bool") {
    // «Да» — не всегда успех: для noindex это предостережение (страница
    // исключена из поиска), teal-бейдж успеха здесь вводил бы в заблуждение.
    const variant = c.boolVariant ?? (c.key === "noindex" ? "warn" : "done");
    return raw ? (
      <span className={"badge badge-" + variant}>Да</span>
    ) : (
      <span className="badge badge-muted">Нет</span>
    );
  }
  if (c.kind === "date") {
    return formatDate(typeof raw === "string" ? raw : null);
  }
  if (c.kind === "map") {
    const key = String(raw ?? "");
    return c.map?.[key] ?? (key || "—");
  }
  if (raw === null || raw === undefined || raw === "") return "—";
  return String(raw);
}

/** Универсальный список сущности: поиск, тумблеры, DnD-порядок, ссылки на сайт. */
export default function ResourceList({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const { msg, show, dismiss } = useToast();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>(""); // "" — все группы
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Удаления в полёте: блокируем повторный клик по «Удалить» этих строк.
  // Set, а не один id: начатое удаление второй строки не разблокирует первую.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Картинки, не загрузившиеся в колонке-миниатюре (показываем плейсхолдер).
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const markBroken = useCallback((url: string) => {
    setBrokenImages((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);
  const reorderBusy = useRef(false);
  // Второй перенос во время сохранения первого не теряется — уходит следом.
  const pendingOrder = useRef<{ id: string; sort: number }[] | null>(null);
  // Возврат фокуса кнопке ↑/↓ после перестановки строк (React ремаунтит <tr>).
  const focusAfterMove = useRef<{ id: string; dir: "up" | "down" } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ResourceItem[]>(
        `/api/v1/admin/${config.path}`
      );
      // Сортируем по sort (если есть), затем по имени.
      data.sort((a, b) => {
        const as = typeof a.sort === "number" ? a.sort : 0;
        const bs = typeof b.sort === "number" ? b.sort : 0;
        if (as !== bs) return as - bs;
        return String(a[config.nameField] ?? "").localeCompare(
          String(b[config.nameField] ?? "")
        );
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Поиск + группы ────────────────────────────────────────────────
  // Ищем по ВСЕМ отображаемым текстовым колонкам (включая русские подписи
  // map-колонок), а не только по nameField+slug: что видно в таблице —
  // то и находится. «ё» ≡ «е» с обеих сторон.
  const searchKeys = useMemo(
    () => config.searchKeys ?? [config.nameField, "slug"],
    [config]
  );
  const normalizedQuery = normalize(query.trim());

  const visible = useMemo(() => {
    let list = items;
    if (config.groupBy && group) {
      list = list.filter((x) => String(x[config.groupBy!.key] ?? "") === group);
    }
    if (normalizedQuery) {
      const haystack = (x: ResourceItem): string => {
        const parts: string[] = [];
        for (const k of searchKeys) {
          const v = x[k];
          if (v !== null && v !== undefined && v !== "") parts.push(String(v));
        }
        for (const c of config.columns) {
          if (
            c.kind === "toggle" ||
            c.kind === "image" ||
            c.kind === "bool" ||
            c.kind === "date" ||
            c.render
          ) {
            continue;
          }
          const v = x[c.key];
          if (v === null || v === undefined || v === "") continue;
          parts.push(String(v));
          if (c.kind === "map" && c.map) {
            const label = c.map[String(v)];
            if (label) parts.push(label);
          }
        }
        return normalize(parts.join("\n"));
      };
      list = list.filter((x) => haystack(x).includes(normalizedQuery));
    }
    return list;
  }, [items, config.columns, config.groupBy, group, normalizedQuery, searchKeys]);

  // DnD доступен без поиска и (для групповых списков) при выбранной группе.
  const reorderEnabled =
    Boolean(config.reorderable) &&
    normalizedQuery === "" &&
    (!config.groupBy || group !== "");

  // ── Тумблер «активна» ─────────────────────────────────────────────
  async function toggleActive(item: ResourceItem, next: boolean) {
    const activeCount = items.filter((x) => Boolean(x.active)).length;
    const confirmText =
      config.confirmToggle?.(item, next, items) ??
      (next && config.maxActive !== undefined && activeCount >= config.maxActive
        ? `Активных записей уже ${activeCount} из ${config.maxActive}. Включить ещё одну?`
        : null);
    if (confirmText && !window.confirm(confirmText)) return;

    // Оптимистично меняем локально; при ошибке откатываем ТОЛЬКО эту строку —
    // снапшот всего списка затёр бы параллельные успешные изменения.
    setItems((cur) =>
      cur.map((x) => (x.id === item.id ? { ...x, active: next } : x))
    );
    try {
      await apiFetch<ResourceItem>(`/api/v1/admin/${config.path}/${item.id}`, {
        method: "PUT",
        body: { active: next },
      });
      // Текст из конфига раздела, если задан (напр. «Редирект включён»);
      // иначе «скрыта с сайта» только для записей со страницей на сайте.
      show(
        config.toggleToast?.(next) ??
          (next
            ? "Запись включена"
            : config.siteHref
            ? "Запись скрыта с сайта"
            : "Запись выключена")
      );
    } catch (err) {
      setItems((cur) =>
        cur.map((x) => (x.id === item.id ? { ...x, active: !next } : x))
      );
      show(translateApiError(err, "Не удалось переключить"), "error");
    }
  }

  // У записи есть СОБСТВЕННАЯ страница на сайте (slug без «/» — новости,
  // документы, планировки): без неё сайт отдаст 404. Якорные ссылки (#faq,
  // тексты секций) и SEO-пути вида «/planirovki» страниц не создают —
  // секция на сайте остаётся в любом случае.
  const hasOwnSitePage = useCallback(
    (item: ResourceItem): boolean => {
      const slug = typeof item.slug === "string" ? item.slug : "";
      return (
        Boolean(config.siteHref?.(item)) && slug !== "" && !slug.startsWith("/")
      );
    },
    [config]
  );

  // ── Удаление ──────────────────────────────────────────────────────
  async function remove(item: ResourceItem) {
    if (deletingIds.has(item.id)) return; // запрос уже в полёте
    const name = String(item[config.nameField] ?? "");
    // У записи есть собственная страница на сайте: предупреждаем о 404
    // и необратимости.
    const hasOwnPage = hasOwnSitePage(item);
    const text =
      config.confirmDelete?.(item, items) ??
      (hasOwnPage
        ? `Удалить запись${name ? ` «${name}»` : ""}? Её страница на сайте перестанет открываться, действие необратимо. Если нужно только скрыть с сайта — выключите тумблер «Активна».`
        : `Удалить запись${name ? ` «${name}»` : ""}?`);
    if (!window.confirm(text)) return;
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    try {
      await apiFetch<void>(`/api/v1/admin/${config.path}/${item.id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      show("Запись удалена");
    } catch (err) {
      show(translateApiError(err, "Ошибка удаления"), "error");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  // ── Сортировка (DnD + стрелки) ────────────────────────────────────
  // Новый порядок видимого подсписка → sort=(i+1)*10 → POST reorder.
  // Если предыдущий reorder ещё сохраняется, новый порядок применяется
  // локально сразу, а на сервер уходит следом (очередь из одного элемента) —
  // быстрые двойные клики по стрелкам не теряются молча.
  async function sendOrder(
    payload: { id: string; sort: number }[],
    /** Состояние списка до этой перестановки; null — откатывать не к чему. */
    prev: ResourceItem[] | null
  ) {
    reorderBusy.current = true;
    try {
      await apiFetch<void>(`/api/v1/admin/${config.path}/reorder`, {
        method: "POST",
        body: payload,
      });
      show("Порядок сохранён");
    } catch (err) {
      if (pendingOrder.current) {
        // Следом едет более свежий порядок — откатывать нечего.
      } else if (prev) {
        setItems(prev);
      } else {
        // Снимка «до» нет (порядок из очереди — состояние успело уехать):
        // берём истину с сервера, иначе список разошёлся бы с БД.
        void load();
      }
      show(translateApiError(err, "Не удалось сохранить порядок"), "error");
    } finally {
      reorderBusy.current = false;
      const pending = pendingOrder.current;
      pendingOrder.current = null;
      // У очередного порядка своего снимка «до» нет: при ошибке перечитываем.
      if (pending) void sendOrder(pending, null);
    }
  }

  function applyOrder(ordered: ResourceItem[]) {
    const payload = ordered.map((x, i) => ({ id: x.id, sort: (i + 1) * 10 }));
    // Локально: обновляем sort у переставленных, пересортировываем весь список.
    const sortMap = new Map(payload.map((p) => [p.id, p.sort]));
    const prevSnapshot = items; // до оптимистичного обновления этого рендера
    setItems((cur) => {
      const next = cur.map((x) =>
        sortMap.has(x.id) ? { ...x, sort: sortMap.get(x.id)! } : x
      );
      next.sort((a, b) => {
        const as = typeof a.sort === "number" ? a.sort : 0;
        const bs = typeof b.sort === "number" ? b.sort : 0;
        if (as !== bs) return as - bs;
        return String(a[config.nameField] ?? "").localeCompare(
          String(b[config.nameField] ?? "")
        );
      });
      return next;
    });
    if (reorderBusy.current) {
      pendingOrder.current = payload;
      return;
    }
    void sendOrder(payload, prevSnapshot);
  }

  function moveItem(from: number, to: number) {
    if (to < 0 || to >= visible.length || from === to) return;
    const ordered = [...visible];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    applyOrder(ordered);
  }

  function onDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    moveItem(dragIndex, index);
    setDragIndex(null);
    setOverIndex(null);
  }

  // Возврат фокуса стрелке ↑/↓ после перестановки: React переносит <tr>
  // через insertBefore, и браузер сбрасывает фокус на <body> — клавиатурная
  // сортировка без этого требует Tab через всю страницу на каждый шаг.
  useEffect(() => {
    const f = focusAfterMove.current;
    if (!f) return;
    focusAfterMove.current = null;
    const btn = document.querySelector<HTMLButtonElement>(
      `[data-arrow="${f.id}-${f.dir}"]`
    );
    if (btn && !btn.disabled) {
      btn.focus();
    } else {
      // Строка упёрлась в край — переводим фокус на противоположную стрелку.
      document
        .querySelector<HTMLButtonElement>(
          `[data-arrow="${f.id}-${f.dir === "up" ? "down" : "up"}"]`
        )
        ?.focus();
    }
  }, [items]);

  // ── Клик по строке (кроме интерактивных элементов) ────────────────
  function onRowClick(e: React.MouseEvent, item: ResourceItem) {
    // Выделение текста (скопировать слаг) — не навигация.
    if (window.getSelection()?.toString()) return;
    // Модификаторы (ctrl/cmd-клик «в новой вкладке» и т.п.) не перехватываем.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const target = e.target as Element;
    if (
      target.closest(
        "a, button, input, select, label, textarea, [role='switch'], [aria-disabled='true'], [draggable='true']"
      )
    ) {
      return;
    }
    router.push(`${config.route}/${item.id}`);
  }

  // «Добавить» при лимите активных — предупреждение, не блок.
  function onAddClick(e: React.MouseEvent) {
    if (config.maxActive === undefined) return;
    const activeCount = items.filter((x) => Boolean(x.active)).length;
    if (activeCount >= config.maxActive) {
      if (
        !window.confirm(
          `Активных записей уже ${activeCount} из ${config.maxActive} — новая не появится на сайте, пока одну не выключите. Продолжить?`
        )
      ) {
        e.preventDefault();
      }
    }
  }

  const banner = config.listBanner ? config.listBanner(items) : null;
  const groupCounts = useMemo(() => {
    if (!config.groupBy) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const x of items) {
      const k = String(x[config.groupBy.key] ?? "");
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [items, config.groupBy]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{config.titlePlural}</h1>
          {config.description && (
            <p className="page-desc">{config.description}</p>
          )}
        </div>
        <div className="spacer" />
        <Link
          className="btn btn-primary"
          href={`${config.route}/new`}
          onClick={onAddClick}
        >
          Добавить
        </Link>
      </div>

      {!loading && !error && banner && (
        <div
          className={
            "alert " + (banner.kind === "warn" ? "alert-warn" : "alert-info")
          }
        >
          {banner.text}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="list-controls">
          {config.groupBy && (
            <div className="chip-row" role="group" aria-label="Группы">
              <button
                type="button"
                className={"chip" + (group === "" ? " active" : "")}
                onClick={() => setGroup("")}
              >
                Все ({items.length})
              </button>
              {config.groupBy.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={"chip" + (group === o.value ? " active" : "")}
                  onClick={() => setGroup(o.value)}
                >
                  {o.label} ({groupCounts.get(o.value) ?? 0})
                </button>
              ))}
            </div>
          )}
          <div className="list-controls-row">
            <input
              type="search"
              className="input list-search"
              placeholder="Поиск…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск по списку"
            />
            <span className="muted list-count">
              Всего: {items.length}
              {visible.length !== items.length
                ? ` · показано ${visible.length}`
                : ""}
            </span>
          </div>
          {config.reorderable && normalizedQuery !== "" ? (
            <p className="field-hint" style={{ margin: 0 }}>
              Во время поиска изменение порядка недоступно — очистите поле
              поиска
            </p>
          ) : config.reorderable && config.groupBy && group === "" ? (
            <p className="field-hint" style={{ margin: 0 }}>
              Перетаскивание доступно внутри выбранной группы — выберите чип
              группы
            </p>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="row-gap" style={{ color: "var(--ink-45)" }}>
          <span className="spin" /> Загрузка…
        </div>
      ) : error ? (
        // Ошибка загрузки — НЕ «Записей пока нет»: честный текст + «Повторить».
        <div>
          <div className="alert alert-error">{error}</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void load()}
          >
            Повторить
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="card list-empty">
          <p style={{ margin: 0 }}>Записей пока нет</p>
          <Link className="btn btn-primary" href={`${config.route}/new`}>
            Добавить первую
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="alert alert-info">
          <div className="row-gap">
            <span>Ничего не найдено — измените запрос или сбросьте фильтр</span>
            {(query !== "" || group !== "") && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setQuery("");
                  setGroup("");
                }}
              >
                Сбросить поиск и фильтры
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {reorderEnabled && <th className="drag-col"></th>}
                {config.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, index) => (
                <tr
                  key={item.id}
                  className={
                    "clickable" +
                    // Индикатор совпадает с местом вставки moveItem: тащим
                    // вниз — строка встаёт ПОСЛЕ подсвеченной (линия снизу),
                    // тащим вверх — ПЕРЕД ней (линия сверху).
                    (overIndex === index && dragIndex !== null
                      ? dragIndex < index
                        ? " drop-target-below"
                        : " drop-target"
                      : "")
                  }
                  onClick={(e) => onRowClick(e, item)}
                  onDragOver={
                    reorderEnabled
                      ? (e) => {
                          e.preventDefault();
                          setOverIndex(index);
                        }
                      : undefined
                  }
                  onDrop={reorderEnabled ? () => onDrop(index) : undefined}
                >
                  {reorderEnabled && (
                    <td className="drag-col">
                      <span
                        className="drag-handle"
                        draggable
                        title="Перетащите, чтобы изменить порядок"
                        aria-label="Изменить порядок"
                        onDragStart={(e) => {
                          setDragIndex(index);
                          e.dataTransfer.effectAllowed = "move";
                          // Firefox не начинает drag без setData
                          e.dataTransfer.setData("text/plain", String(item.id));
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                      >
                        ⋮⋮
                      </span>
                      <span className="drag-arrows">
                        <button
                          type="button"
                          className="drag-arrow"
                          aria-label="Выше"
                          data-arrow={`${item.id}-up`}
                          disabled={index === 0}
                          onClick={() => {
                            focusAfterMove.current = {
                              id: String(item.id),
                              dir: "up",
                            };
                            moveItem(index, index - 1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="drag-arrow"
                          aria-label="Ниже"
                          data-arrow={`${item.id}-down`}
                          disabled={index === visible.length - 1}
                          onClick={() => {
                            focusAfterMove.current = {
                              id: String(item.id),
                              dir: "down",
                            };
                            moveItem(index, index + 1);
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    </td>
                  )}
                  {config.columns.map((c) => (
                    <td key={c.key} className={cellClass(c)}>
                      {renderCell(
                        c,
                        item,
                        config,
                        toggleActive,
                        brokenImages,
                        markBroken
                      )}
                    </td>
                  ))}
                  <td className="actions-col">
                    {/* Иконочные действия: текстовые кнопки в узкой колонке
                        переносились по слогам («Из-ме-нить») и превращались
                        в нечитаемую полоску. Подписи остаются в title и
                        aria-label — смысл кнопки доступен и мыши, и
                        скринридеру. */}
                    <div className="row-actions">
                      {config.siteHref &&
                        config.siteHref(item) &&
                        // Выключенная запись СО СВОЕЙ страницей на сайте
                        // отдаёт 404 — ссылка неактивна с объяснением вместо
                        // «битой» вкладки. Для якорных ссылок (тексты секций,
                        // FAQ, команда) секция на сайте остаётся — ссылка живая.
                        (item.active === false && hasOwnSitePage(item) ? (
                          <span
                            className="icon-btn icon-btn-inert"
                            role="link"
                            aria-disabled="true"
                            aria-label={
                              actionLabel("Открыть на сайте", item, config) +
                              " — запись выключена"
                            }
                            title="Запись выключена — на сайте её сейчас нет"
                          >
                            <ExternalLinkIcon />
                          </span>
                        ) : (
                          <a
                            className="icon-btn"
                            href={config.siteHref(item)!}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={actionLabel(
                              "Открыть на сайте",
                              item,
                              config
                            )}
                            title="Открыть на сайте"
                          >
                            <ExternalLinkIcon />
                          </a>
                        ))}
                      <Link
                        className="icon-btn"
                        href={`${config.route}/${item.id}`}
                        aria-label={actionLabel("Изменить", item, config)}
                        title="Изменить"
                      >
                        <PencilIcon />
                      </Link>
                      <button
                        type="button"
                        className="icon-btn icon-btn-danger"
                        disabled={deletingIds.has(item.id)}
                        aria-label={
                          deletingIds.has(item.id)
                            ? "Удаление…"
                            : actionLabel("Удалить", item, config)
                        }
                        title={
                          deletingIds.has(item.id) ? "Удаление…" : "Удалить"
                        }
                        onClick={() => remove(item)}
                      >
                        {deletingIds.has(item.id) ? (
                          <span className="spin spin-sm" aria-hidden="true" />
                        ) : (
                          <TrashIcon width={16} height={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Toast msg={msg} onClose={dismiss} />
    </div>
  );
}
