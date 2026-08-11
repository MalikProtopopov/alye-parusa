import { DomainError } from "../shared/domain-error";
import type { InstallmentQuote } from "../entities/installment";

/**
 * Pure installment math — the client mirror of the backend's POST /calc:
 *   down     = price × pct
 *   financed = price − down
 *   markup   = financed × markup_frac × months / 12
 *   monthly  = (financed + markup) / months
 *   total    = price + markup
 * All percentages are fractions 0..1 — NO division by 100 anywhere.
 */
export function calculateInstallment({
  price,
  downPaymentPct,
  months,
  markupPctAnnual,
}: {
  price: number;
  downPaymentPct: number;
  months: number;
  markupPctAnnual: number;
}): InstallmentQuote {
  if (!Number.isFinite(price) || price <= 0) {
    throw new DomainError(`Installment price must be positive, got ${price}`);
  }
  // Ровно 1 допустимо: админ может разрешить 100 % взнос (financed = 0, платёж 0)
  if (!Number.isFinite(downPaymentPct) || downPaymentPct < 0 || downPaymentPct > 1) {
    throw new DomainError(
      `Down payment must be a fraction in [0, 1], got ${downPaymentPct}`,
    );
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new DomainError(`Installment term must be a positive number of months, got ${months}`);
  }
  if (!Number.isFinite(markupPctAnnual) || markupPctAnnual < 0) {
    throw new DomainError(`Annual markup must be a non-negative fraction, got ${markupPctAnnual}`);
  }

  const downPayment = price * downPaymentPct;
  const financed = price - downPayment;
  const markup = (financed * markupPctAnnual * months) / 12;
  const monthlyPayment = (financed + markup) / months;
  const totalCost = price + markup;

  return {
    price,
    downPaymentPct,
    downPayment,
    financed,
    months,
    markupPctAnnual,
    markup,
    monthlyPayment,
    totalCost,
  };
}
