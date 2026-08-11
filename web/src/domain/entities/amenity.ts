export type AmenityCategory = "living" | "leisure" | "infrastructure";

/** A single «город в городе» feature. */
export interface Amenity {
  id: string;
  title: string;
  description: string;
  category: AmenityCategory;
}
