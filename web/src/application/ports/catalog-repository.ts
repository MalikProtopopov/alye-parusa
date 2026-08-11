import type { Floorplan, InstallmentParams, PlanCategory } from "@/domain";

/**
 * Outbound port for the floorplan catalog + installment settings.
 * List adapters degrade to empty results (never throw) — the pages render a
 * soft empty state when the CMS is unreachable. The slug lookup is different:
 * null strictly means «no such floorplan» (404); an unreachable backend
 * propagates as ApiUnavailableError so the page answers 5xx, not a soft 404.
 */
export interface CatalogRepository {
  listCategories(): Promise<PlanCategory[]>;
  /** Unknown category slug → empty list (backend answers 404 category_not_found). */
  listFloorplans(categorySlug?: string): Promise<Floorplan[]>;
  /** null ⇔ 404; сеть/5xx — throw (страница отдаёт честный 5xx). */
  getFloorplanBySlug(slug: string): Promise<Floorplan | null>;
  getCalculatorParams(): Promise<InstallmentParams | null>;
}
