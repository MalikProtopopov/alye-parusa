"use client";

/**
 * Дашборд «Обзор» — first-party аналитика продаж (заявки сайта).
 * Визуализация по dataviz-методике: формы по задаче данных
 * (stat-плитки / одна линия времени / горизонтальные бары), один цвет данных
 * — каспийский teal #1C5F57 + алый акцент #C23A29 («Алые Паруса»),
 * тонкие марки, прямые подписи выборочно, таблица-дубль для доступности.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, getRole } from "../../lib/api";
import type { Lead } from "../../lib/types";
import { formatDate, leadKindLabel } from "../../lib/labels";

const DATA = "#1C5F57";   // основной цвет данных (каспийский teal бренда)
const ACCENT = "#C23A29"; // акцент (лакричный алый) — только для точки «сегодня»

// GET /api/v1/admin/health — проверки «здоровья контента» (admin only).
interface HealthCheck {
  id: string;
  status: "ok" | "warn";
  label: string;
  detail?: string;
  count?: number;
  link: string;
}
interface HealthResponse {
  checks: HealthCheck[];
}

interface Stats {
  totals: { total: number; last7: number; last30: number };
  by_status: { new: number; in_progress: number; done: number };
  done_rate: number;
  daily: { date: string; count: number }[];
  by_kind: { label: string; count: number }[];
  by_block: { label: string; count: number }[];
  by_utm: { label: string; count: number }[];
  by_floorplan: { label: string; count: number }[];
  calc: {
    with_calc: number;
    avg_price: number | null;
    avg_monthly_payment: number | null;
  };
}

const KIND_RU: Record<string, string> = {
  simple_callback: "Обратный звонок",
  with_calc: "С расчётом",
  without_calc: "Без расчёта",
  presentation: "Презентация",
  floorplan: "По планировке",
};
const nf = new Intl.NumberFormat("ru-RU");
const NB = " ";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Stats>("/api/v1/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats)
    return (
      <div className="row-gap" style={{ color: "var(--ink-45)" }}>
        <span className="spin" /> Загрузка…
      </div>
    );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Обзор</h1>
          <p className="page-desc">
            Аналитика заявок с сайта: динамика, источники, спрос по планировкам.
            Дополняет Яндекс.Метрику собственными данными продаж.
          </p>
        </div>
      </div>

      {/* Здоровье контента (только admin; 403/ошибка → панель скрыта) */}
      <HealthPanel />

      {/* KPI-плитки (кликабельные — ведут в «Заявки») */}
      <div className="dash-kpis">
        <Kpi
          label="Всего заявок"
          value={nf.format(stats.totals.total)}
          href="/leads"
        />
        <Kpi
          label="За 7 дней"
          value={nf.format(stats.totals.last7)}
          hint={`за 30 дней — ${nf.format(stats.totals.last30)}`}
          href="/leads"
        />
        <Kpi
          label="Обработано"
          value={`${stats.done_rate}%`}
          hint={`${nf.format(stats.by_status.done)} из ${nf.format(stats.totals.total)}`}
          href="/leads?status=done"
        />
        <Kpi
          label="Средний платёж/мес"
          value={
            stats.calc.avg_monthly_payment != null
              ? `${nf.format(Math.round(stats.calc.avg_monthly_payment))}${NB}₽`
              : "—"
          }
          hint={`заявок с расчётом — ${nf.format(stats.calc.with_calc)}`}
          href="/leads"
        />
      </div>

      {/* Свежие новые заявки */}
      <NewLeadsWidget />

      {/* Динамика 30 дней */}
      <section className="card dash-card">
        <h2 className="dash-h">Заявки по дням — последние 30 дней</h2>
        <AreaChart daily={stats.daily} />
        <details className="dash-table">
          <summary>Таблица данных</summary>
          <table className="data">
            <thead><tr><th>Дата</th><th>Заявок</th></tr></thead>
            <tbody>
              {stats.daily.map((d) => (
                <tr key={d.date}><td>{d.date}</td><td className="mono">{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="dash-grid">
        <BarCard title="Воронка обработки" items={[
          { label: "Новые", count: stats.by_status.new },
          { label: "В работе", count: stats.by_status.in_progress },
          { label: "Обработанные", count: stats.by_status.done },
        ]} />
        <BarCard title="Типы заявок" items={stats.by_kind.map((x) => ({ ...x, label: KIND_RU[x.label] ?? x.label }))} />
        <BarCard title="Блоки-источники на сайте" items={stats.by_block} />
        <BarCard title="Рекламные источники (UTM)" items={stats.by_utm} empty="UTM-меток пока нет — появятся с запуском рекламы" />
        <BarCard title="Спрос по планировкам" items={stats.by_floorplan} empty="Заявок с привязкой к планировке пока нет" wide />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="dash-kpi__value mono">{value}</div>
      <div className="dash-kpi__label">{label}</div>
      {hint && <div className="dash-kpi__hint">{hint}</div>}
    </>
  );
  return href ? (
    <Link className="card dash-kpi dash-kpi--link" href={href}>
      {body}
    </Link>
  ) : (
    <div className="card dash-kpi">{body}</div>
  );
}

/** Секция-плейсхолдер на время загрузки: резервирует место, чтобы контент
    ниже не «прыгал» после первой отрисовки (сдвиг под курсором).
    minHeight задаётся вызывающей секцией под её реальную высоту — общие
    48px схлопывались, и график всё равно подпрыгивал. */
function SectionPlaceholder({
  title,
  minHeight,
}: {
  title: string;
  minHeight: number;
}) {
  const [visible, setVisible] = useState(false);
  // Спиннер показываем с задержкой, чтобы быстрый ответ не мерцал.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="card dash-card" aria-busy="true">
      <h2 className="dash-h">{title}</h2>
      <div
        className="row-gap"
        style={{ color: "var(--ink-45)", minHeight }}
      >
        {visible && (
          <>
            <span className="spin" /> Загрузка…
          </>
        )}
      </div>
    </section>
  );
}

/** «Здоровье контента»: GET /admin/health, только для суперадмина.
    403 или ошибка сети → панель просто не показывается. Пока идёт запрос —
    плейсхолдер, чтобы появление панели не сдвигало график под курсором. */
function HealthPanel() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [status, setStatus] = useState<"loading" | "hidden" | "ready">(
    "loading"
  );

  useEffect(() => {
    if (getRole() !== "admin") {
      setStatus("hidden");
      return;
    }
    let cancelled = false;
    apiFetch<HealthResponse>("/api/v1/admin/health")
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.checks) && data.checks.length > 0) {
          setChecks(data.checks);
          setStatus("ready");
        } else {
          setStatus("hidden");
        }
      })
      .catch(() => {
        // 403 — менеджер; прочее — бэкенд без эндпоинта: скрываем панель.
        if (!cancelled) setStatus("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "hidden") return null;
  if (status === "loading" || !checks) {
    // ≈6 проверок: строка 20px + gap 8px.
    return <SectionPlaceholder title="Здоровье контента" minHeight={152} />;
  }
  const warns = checks.filter((c) => c.status === "warn").length;

  return (
    <section className="card dash-card dash-health">
      <h2 className="dash-h">
        Здоровье контента
        {warns > 0 ? (
          <span className="dash-health__sum warn"> · требуют внимания: {warns}</span>
        ) : (
          <span className="dash-health__sum ok"> · всё в порядке</span>
        )}
      </h2>
      <ul className="dash-health__list">
        {checks.map((c) => (
          <li key={c.id} className="dash-health__item">
            <span
              className={"dash-health__dot " + c.status}
              aria-label={c.status === "ok" ? "в порядке" : "требует внимания"}
            />
            <Link href={c.link} className="dash-health__label">
              {c.label}
              {typeof c.count === "number" ? ` — ${c.count}` : ""}
            </Link>
            {c.detail && (
              <span className="dash-health__detail muted">{c.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Пять последних новых заявок — быстрый вход в обработку. Пока идёт
    запрос — плейсхолдер (см. SectionPlaceholder), чтобы не сдвигать график. */
function NewLeadsWidget() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [status, setStatus] = useState<"loading" | "hidden" | "ready">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch<Lead[]>("/api/v1/admin/leads?status=new")
      .then((data) => {
        if (cancelled) return;
        const top = data.slice(0, 5);
        if (top.length > 0) {
          setLeads(top);
          setStatus("ready");
        } else {
          setStatus("hidden");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "hidden") return null;
  if (status === "loading" || !leads) {
    // До 5 заявок: строка 20px + вертикальные отступы 8+8.
    return <SectionPlaceholder title="Новые заявки" minHeight={180} />;
  }

  return (
    <section className="card dash-card">
      <h2 className="dash-h">
        Новые заявки <Link href="/leads?status=new" className="dash-h__more">все →</Link>
      </h2>
      <ul className="dash-leads">
        {leads.map((l) => (
          <li key={l.id}>
            <Link href={`/leads?lead=${l.id}`} className="dash-lead">
              <span className="dash-lead__name">{l.name}</span>
              <span className="dash-lead__phone mono">{l.phone}</span>
              <span className="dash-lead__kind muted">
                {leadKindLabel(l.kind)}
              </span>
              <span className="dash-lead__date muted">
                {formatDate(l.created_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Одна серия во времени: линия 2px + светлая заливка, кросс-хэйр с тултипом,
    приглушённая сетка, выборочная прямая подпись (последняя точка). */
function AreaChart({ daily }: { daily: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 170, PAD = { t: 14, r: 46, b: 24, l: 8 };

  const { pts, max } = useMemo(() => {
    const max = Math.max(1, ...daily.map((d) => d.count));
    const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    const pts = daily.map((d, i) => ({
      x: PAD.l + (i / Math.max(1, daily.length - 1)) * iw,
      y: PAD.t + ih - (d.count / max) * ih,
      ...d,
    }));
    return { pts, max };
  }, [daily]);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H - PAD.b} L${pts[0].x.toFixed(1)} ${H - PAD.b} Z`;
  const last = pts[pts.length - 1];
  const h = hover != null ? pts[hover] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  const fmt = (iso: string) => iso.slice(8, 10) + "." + iso.slice(5, 7);

  return (
    <div className="dash-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Заявки по дням за 30 дней"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* приглушённая сетка: 3 линии + подписи макс/половина */}
        {[0.5, 1].map((f) => {
          const y = PAD.t + (H - PAD.t - PAD.b) * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="var(--sand-200)" strokeWidth="1" />
              <text x={W - PAD.r + 6} y={y + 4} fontSize="11" fill="var(--ink-45)">{Math.round(max * f)}</text>
            </g>
          );
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--sand-200)" strokeWidth="1" />
        {/* область + линия */}
        <path d={area} fill={DATA} opacity="0.10" />
        <path d={line} fill="none" stroke={DATA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* прямая подпись последней точки (сегодня) — акцент */}
        <circle cx={last.x} cy={last.y} r="4" fill={ACCENT} stroke="#FCF8F0" strokeWidth="2" />
        <text x={last.x} y={Math.max(12, last.y - 10)} fontSize="12" fontWeight="700" textAnchor="middle" fill="var(--ink)">
          {last.count}
        </text>
        {/* даты: первая / середина / последняя */}
        {[0, Math.floor(pts.length / 2), pts.length - 1].map((i) => (
          <text key={i} x={pts[i].x} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--ink-45)">
            {fmt(pts[i].date)}
          </text>
        ))}
        {/* кросс-хэйр */}
        {h && (
          <g>
            <line x1={h.x} x2={h.x} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-45)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={h.x} cy={h.y} r="4.5" fill={DATA} stroke="#FCF8F0" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="dash-tip" style={{ left: `${(h.x / W) * 100}%` }}>
          <span className="mono">{h.count}</span> · {fmt(h.date)}
        </div>
      )}
    </div>
  );
}

/** Горизонтальные бары одной меры: тонкие, скруглённый торец 4px, значение текстом. */
function BarCard({ title, items, empty, wide }: {
  title: string; items: { label: string; count: number }[]; empty?: string; wide?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className={`card dash-card${wide ? " dash-card--wide" : ""}`}>
      <h2 className="dash-h">{title}</h2>
      {items.length ? (
        <div className="dash-bars">
          {items.map((i) => (
            <div className="dash-bar" key={i.label} title={`${i.label}: ${i.count}`}>
              <span className="dash-bar__label">{i.label}</span>
              <span className="dash-bar__track">
                <span className="dash-bar__fill" style={{ width: `${(i.count / max) * 100}%`, background: DATA }} />
              </span>
              <span className="dash-bar__value mono">{i.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="dash-empty">{empty ?? "Пока нет данных"}</p>
      )}
    </section>
  );
}
