export type BrandRole = "developer" | "sales" | "architecture";

export interface Brand {
  id: string;
  name: string;
  role: BrandRole;
  /** Human label — застройщик / продажи / архитектура. */
  roleLabel: string;
}
