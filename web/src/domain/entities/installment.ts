/**
 * Installment-plan settings from the CMS.
 * ⚠️ All *_pct values are FRACTIONS 0..1 (0.30 = 30 %) — never divide by 100.
 */
export interface InstallmentParams {
  minDownPaymentPct: number;
  maxDownPaymentPct: number;
  termMinMonths: number;
  termMaxMonths: number;
  termStepMonths: number;
  /** Annual markup on the financed part, fraction 0..1 (0 = interest-free). */
  markupPctAnnual: number;
  pricePerM2: number | null;
  disclaimer: string | null;
}

/** One computed installment quote — mirrors the backend's CalcResult. */
export interface InstallmentQuote {
  price: number;
  downPaymentPct: number;
  downPayment: number;
  financed: number;
  months: number;
  markupPctAnnual: number;
  markup: number;
  monthlyPayment: number;
  totalCost: number;
}
