/** The physical program of the complex (real figures from the brief). */
export interface ApartmentProgram {
  buildings: number;
  floors: number;
  minAreaM2: number;
  maxAreaM2: number;
  landHectares: number;
  promenadeMeters: number;
}

/** A delivery/finish option: Черновая / White Box / Готовый ремонт. */
export interface FinishType {
  id: string;
  name: string;
  description: string;
}
