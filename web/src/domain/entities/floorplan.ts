export type AvailabilityStatus = "available" | "reserved" | "sold";

export interface PlanCategory {
  id: string;
  title: string;
  slug: string;
  /** Sanitized HTML intro of the category page (CMS), or null. */
  descriptionHtml: string | null;
  /** ISO datetime of the last CMS edit, or null (older backend). */
  updatedAt: string | null;
}

export interface Floorplan {
  id: string;
  title: string;
  slug: string;
  /** Sanitized HTML from the CMS editor. */
  descriptionHtml: string | null;
  areaM2: number;
  /** null — цена по запросу (в т.ч. когда цены скрыты по всему сайту). */
  price: number | null;
  availability: AvailabilityStatus;
  floor: number | null;
  ceilingHeight: number | null;
  imageUrl: string | null;
  /** Lightweight parent-category reference (no description on the wire). */
  category: Pick<PlanCategory, "id" | "title" | "slug"> | null;
  /** ISO datetime of the last CMS edit, or null. */
  updatedAt: string | null;
}
