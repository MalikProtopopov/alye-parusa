import { calculateInstallment } from "@/domain";
import type { InstallmentParams, InstallmentQuote } from "@/domain";
import type { CatalogRepository } from "../ports/catalog-repository";

export async function getCalculatorParams(
  repo: CatalogRepository,
): Promise<InstallmentParams | null> {
  return repo.getCalculatorParams();
}

/**
 * Marketing teaser «от N ₽/мес»: the minimal advertised monthly payment —
 * minimal down payment over the maximal term (as approved in the plan).
 */
export function installmentTeaser(
  params: InstallmentParams,
  price: number,
): InstallmentQuote | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  try {
    return calculateInstallment({
      price,
      downPaymentPct: params.minDownPaymentPct,
      months: params.termMaxMonths,
      markupPctAnnual: params.markupPctAnnual,
    });
  } catch {
    return null;
  }
}
