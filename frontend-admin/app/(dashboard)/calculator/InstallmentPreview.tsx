"use client";

// Живой пример расчёта рассрочки из state формы (до сохранения), по паттерну
// BannerPreview. Демо-апартамент 40 м². Поля формы теперь в ПРОЦЕНТАХ
// (30 = 30 %) — перед математикой делим на 100; API продолжает хранить доли.

import { formatPrice } from "../../lib/labels";
import { parseDecimal } from "../../lib/validation";

const DEMO_AREA_M2 = 40;

// parseDecimal, а не Number(): поля формы принимают «8,5» и «150 000»
function num(v: string | boolean | undefined): number | null {
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = parseDecimal(v);
  return Number.isFinite(n) ? n : null;
}

export default function InstallmentPreview({
  form,
}: {
  form: Record<string, string | boolean>;
}) {
  const pricePerM2 = num(form.price_per_m2);
  // Значения формы — проценты (0..100) → доли (0..1).
  const minDownPctInput = num(form.min_down_payment_pct);
  const minDownPct = minDownPctInput === null ? null : minDownPctInput / 100;
  const months = num(form.term_max_months);
  const markupPctAnnual = (num(form.markup_pct_annual) ?? 0) / 100;
  const disclaimer =
    typeof form.disclaimer === "string" ? form.disclaimer.trim() : "";

  const ready =
    pricePerM2 !== null &&
    pricePerM2 > 0 &&
    minDownPct !== null &&
    minDownPct >= 0 &&
    minDownPct < 1 &&
    months !== null &&
    months > 0;

  let body: React.ReactNode;
  if (!ready) {
    // Называем только реально незаполненные/некорректные поля; отдельный
    // случай — взнос 100 %: все поля заполнены, но рассрочки при нём нет.
    const missing: string[] = [];
    if (pricePerM2 === null || pricePerM2 <= 0) missing.push("цену за м²");
    if (minDownPct === null || minDownPct < 0) {
      missing.push("минимальный взнос");
    }
    if (months === null || months <= 0) missing.push("максимальный срок");
    const fullDown = minDownPct !== null && minDownPct >= 1;
    body = (
      <p className="dash-empty" style={{ margin: 0 }}>
        {missing.length === 0 && fullDown
          ? "При первом взносе 100 % рассрочка не нужна — пример расчёта недоступен."
          : `Заполните ${missing.join(", ")} — пример расчёта появится здесь.`}
      </p>
    );
  } else {
    const price = pricePerM2! * DEMO_AREA_M2;
    const down = price * minDownPct!;
    const financed = price - down;
    const markup = (financed * markupPctAnnual * months!) / 12;
    const monthly = (financed + markup) / months!;
    body = (
      <>
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Стоимость</dt>
          <dd className="mono">{formatPrice(Math.round(price))}</dd>
          <dt>Первый взнос</dt>
          <dd className="mono">
            {formatPrice(Math.round(down))} ({Math.round(minDownPct! * 100)} %)
          </dd>
          <dt>Срок</dt>
          <dd>{months} мес.</dd>
          {markup > 0 && (
            <>
              <dt>Удорожание</dt>
              <dd className="mono">{formatPrice(Math.round(markup))}</dd>
            </>
          )}
        </dl>
        <div style={{ marginTop: "var(--sp-4)" }}>
          <div className="dash-kpi__value mono">
            {formatPrice(Math.round(monthly))}
          </div>
          <div className="dash-kpi__label">Платёж в месяц</div>
        </div>
        {disclaimer !== "" && (
          <p
            className="field-hint"
            style={{ marginTop: "var(--sp-4)", marginBottom: 0 }}
          >
            {disclaimer}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="banner-preview-label">Пример расчёта</div>
      <div className="card" style={{ padding: "var(--sp-5)" }}>{body}</div>
      <p className="banner-preview-note">
        Демо-апартамент {DEMO_AREA_M2} м², минимальный взнос и максимальный
        срок. Так рассрочку увидит посетитель сайта.
      </p>
    </>
  );
}
