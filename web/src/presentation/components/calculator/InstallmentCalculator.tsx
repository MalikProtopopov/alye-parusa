"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { calculateInstallment } from "@/domain";
import type { InstallmentParams, InstallmentQuote } from "@/domain";
import { formatAreaM2, formatPriceRub } from "@/presentation/lib/format";
import { LeadForm } from "../lead/LeadForm";
import type { CalcSnapshot } from "../lead/LeadForm";
import { Select } from "../primitives/Select";
import type { SelectOption } from "../primitives/Select";
import styles from "./InstallmentCalculator.module.css";

/** Serializable floorplan option for the select (RSC → client boundary). */
export interface CalculatorPlanOption {
  id: string;
  title: string;
  areaM2: number;
  price: number | null;
}

const CUSTOM = "custom";

// Неразрывный пробел: «30 %» и «36 мес» не должны разрываться между строк.
// Собираем подписи функциями: в тексте JSX escape-последовательность не
// раскрывается и вывелась бы на страницу буквально.
const pctLabel = (fraction: number) => `${Math.round(fraction * 100)}\u00A0%`;
const monthsLabel = (months: number) => `${months}\u00A0мес`;

/** Русские числительные для подписи под платежом. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Доля пройденной части дорожки — красит заполнение ползунка.
 * Webkit читает её из градиента дорожки, Firefox — из ::-moz-range-progress.
 */
function fillStyle(value: number, min: number, max: number): CSSProperties {
  const ratio = max > min ? (value - min) / (max - min) : 1;
  return { "--fill": `${Math.round(ratio * 100)}%` } as CSSProperties;
}

function buildSnapshot(
  quote: InstallmentQuote,
  mode: "floorplan" | "amount",
  floorplanId: string | undefined,
  disclaimer: string | null,
): CalcSnapshot {
  return {
    input: {
      mode,
      ...(mode === "floorplan" ? { floorplan_id: floorplanId } : { amount: quote.price }),
      down_payment_pct: quote.downPaymentPct,
      months: quote.months,
    },
    result: {
      price: quote.price,
      down_payment_pct: quote.downPaymentPct,
      down_payment: quote.downPayment,
      financed: quote.financed,
      months: quote.months,
      markup_pct_annual: quote.markupPctAnnual,
      markup: quote.markup,
      monthly_payment: quote.monthlyPayment,
      total_cost: quote.totalCost,
      disclaimer,
    },
  };
}

/**
 * Interactive installment calculator — the client mirror of POST /calc.
 * Fractions 0..1 throughout; the down-payment slider works in integer percent
 * purely for crisp UI steps.
 */
export function InstallmentCalculator({
  params,
  plans,
  policyHref,
}: {
  params: InstallmentParams;
  plans: CalculatorPlanOption[];
  policyHref?: string;
}) {
  const planLabelId = useId();
  const minPct = Math.round(params.minDownPaymentPct * 100);
  const maxPct = Math.round(params.maxDownPaymentPct * 100);

  const defaultPlan = plans.find((plan) => plan.price !== null);
  const [selection, setSelection] = useState<string>(defaultPlan?.id ?? CUSTOM);
  const [amountInput, setAmountInput] = useState<string>(() => {
    if (defaultPlan?.price) return String(defaultPlan.price);
    if (params.pricePerM2) return String(Math.round(params.pricePerM2 * 40));
    return "5000000";
  });
  const [pct, setPct] = useState<number>(minPct);
  const [months, setMonths] = useState<number>(params.termMaxMonths);

  const selectedPlan = selection === CUSTOM ? null : plans.find((p) => p.id === selection);
  const isCustom = selection === CUSTOM;
  const price = isCustom ? Number(amountInput) || 0 : (selectedPlan?.price ?? 0);
  const priceUnavailable = !isCustom && selectedPlan?.price === null;

  const quote = useMemo(() => {
    if (price <= 0) return null;
    try {
      return calculateInstallment({
        price,
        downPaymentPct: pct / 100,
        months,
        markupPctAnnual: params.markupPctAnnual,
      });
    } catch {
      return null;
    }
  }, [price, pct, months, params.markupPctAnnual]);

  const planOptions: SelectOption[] = [
    ...plans.map((plan) => ({
      value: plan.id,
      label: plan.title,
      hint: `${formatAreaM2(plan.areaM2)} · ${plan.price !== null ? formatPriceRub(plan.price) : "цена по запросу"}`,
    })),
    { value: CUSTOM, label: "Своя сумма", hint: "Ввести стоимость вручную" },
  ];

  const snapshot = quote
    ? buildSnapshot(
        quote,
        isCustom ? "amount" : "floorplan",
        selectedPlan?.id,
        params.disclaimer,
      )
    : undefined;

  return (
    <div className={styles.calculator}>
      <div className={styles.stage}>
        <div className={styles.controls}>
          <div className={styles.control}>
            <span className={styles.controlLabel} id={planLabelId}>
              Апартамент
            </span>
            <Select
              className={styles.select}
              value={selection}
              options={planOptions}
              labelId={planLabelId}
              placeholder="Выберите апартамент"
              onChange={(next) => {
                setSelection(next);
                const plan = plans.find((p) => p.id === next);
                if (plan?.price) setAmountInput(String(plan.price));
              }}
            />
          </div>

          {isCustom ? (
            <label className={styles.control}>
              <span className={styles.controlLabel}>Стоимость, ₽</span>
              <input
                className={styles.amount}
                type="number"
                inputMode="numeric"
                min={100000}
                step={50000}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </label>
          ) : null}

          <label className={styles.control}>
            <span className={styles.controlHead}>
              <span className={styles.controlLabel}>Первоначальный взнос</span>
              <output className={styles.controlValue}>{pctLabel(pct / 100)}</output>
            </span>
            <input
              className={styles.range}
              style={fillStyle(pct, minPct, maxPct)}
              type="range"
              min={minPct}
              max={maxPct}
              step={5}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-label="Первоначальный взнос, процентов"
            />
            <span className={styles.rangeScale}>
              <span>{pctLabel(params.minDownPaymentPct)}</span>
              <span>{pctLabel(params.maxDownPaymentPct)}</span>
            </span>
          </label>

          <label className={styles.control}>
            <span className={styles.controlHead}>
              <span className={styles.controlLabel}>Срок рассрочки</span>
              <output className={styles.controlValue}>{monthsLabel(months)}</output>
            </span>
            <input
              className={styles.range}
              style={fillStyle(months, params.termMinMonths, params.termMaxMonths)}
              type="range"
              min={params.termMinMonths}
              max={params.termMaxMonths}
              step={params.termStepMonths}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              aria-label="Срок рассрочки, месяцев"
            />
            <span className={styles.rangeScale}>
              <span>{monthsLabel(params.termMinMonths)}</span>
              <span>{monthsLabel(params.termMaxMonths)}</span>
            </span>
          </label>
        </div>

        <div className={styles.readout} aria-live="polite">
          {priceUnavailable ? (
            <p className={styles.unavailable}>
              Цена этого апартамента — по запросу. Оставьте заявку, и менеджер
              рассчитает рассрочку персонально.
            </p>
          ) : quote ? (
            <>
              <dl className={styles.figures}>
                <div className={styles.headline}>
                  <dt className={styles.headlineLabel}>Ежемесячный платёж</dt>
                  <dd className={styles.headlineValue}>
                    {formatPriceRub(quote.monthlyPayment)}
                    <span className={styles.headlineNote}>
                      {quote.months}{" "}
                      {pluralRu(
                        quote.months,
                        "равный платёж",
                        "равных платежа",
                        "равных платежей",
                      )}
                      {quote.markup > 0 ? "" : " · без переплаты"}
                    </span>
                  </dd>
                </div>
                <div className={styles.minor}>
                  <dt className={styles.minorLabel}>Первый взнос</dt>
                  <dd className={styles.minorValue}>
                    {formatPriceRub(quote.downPayment)}
                  </dd>
                </div>
                <div className={styles.minor}>
                  <dt className={styles.minorLabel}>Удорожание</dt>
                  <dd className={styles.minorValue}>
                    {quote.markup > 0 ? formatPriceRub(quote.markup) : "0 ₽"}
                  </dd>
                </div>
                <div className={styles.minor}>
                  <dt className={styles.minorLabel}>Итого</dt>
                  <dd className={styles.minorValue}>{formatPriceRub(quote.totalCost)}</dd>
                </div>
              </dl>
              {params.disclaimer ? (
                <p className={styles.disclaimer}>{params.disclaimer}</p>
              ) : null}
            </>
          ) : (
            <p className={styles.unavailable}>Укажите стоимость, чтобы увидеть расчёт.</p>
          )}
        </div>
      </div>

      <div className={styles.lead}>
        <div>
          <h3 className={styles.leadTitle}>Получить персональный расчёт</h3>
          <p className={styles.leadNote}>
            Менеджер подтвердит условия и пришлёт график платежей.
          </p>
        </div>
        <div className={styles.leadForm}>
          <LeadForm
            kind={snapshot ? "with_calc" : "without_calc"}
            floorplanId={selectedPlan?.id}
            calcSnapshot={snapshot}
            sourceBlock="calculator"
            policyHref={policyHref}
            submitLabel="Получить расчёт"
          />
        </div>
      </div>
    </div>
  );
}
