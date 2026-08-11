import type { ApartmentProgram, FinishType, RenderImage } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface ResidencesView {
  program: ApartmentProgram;
  finishes: FinishType[];
  gallery: RenderImage[];
}

export async function getResidences(repo: ContentRepository): Promise<ResidencesView> {
  const [program, finishes, gallery] = await Promise.all([
    repo.getApartmentProgram(),
    repo.getFinishTypes(),
    repo.getRenders(),
  ]);
  return { program, finishes, gallery };
}
