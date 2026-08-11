import type { Floorplan, PlanCategory } from "@/domain";
import type { CatalogRepository } from "../ports/catalog-repository";

export interface CatalogView {
  categories: PlanCategory[];
  floorplans: Floorplan[];
  /** The active category filter, when the slug matched one. */
  activeCategory: PlanCategory | null;
}

/**
 * Catalog page data. With a category slug: filters server-side via the API;
 * an unknown slug simply yields an empty list (the route then tries to resolve
 * the slug as a floorplan instead).
 */
export async function getCatalog(
  repo: CatalogRepository,
  categorySlug?: string,
): Promise<CatalogView> {
  const categories = await repo.listCategories();
  const activeCategory = categorySlug
    ? (categories.find((c) => c.slug === categorySlug) ?? null)
    : null;
  const floorplans = await repo.listFloorplans(activeCategory?.slug);
  return { categories, floorplans, activeCategory };
}

/** Up to `limit` featured floorplans for the landing section. */
export async function getFeaturedFloorplans(
  repo: CatalogRepository,
  limit = 6,
): Promise<Floorplan[]> {
  const floorplans = await repo.listFloorplans();
  return floorplans.slice(0, limit);
}

export async function getFloorplan(
  repo: CatalogRepository,
  slug: string,
): Promise<Floorplan | null> {
  return repo.getFloorplanBySlug(slug);
}
