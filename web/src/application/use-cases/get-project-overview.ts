import type { Amenity, Project } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface ProjectOverviewView {
  project: Project;
  /** «Город в городе» highlights — the living-oriented amenities. */
  advantages: Amenity[];
}

export async function getProjectOverview(
  repo: ContentRepository,
): Promise<ProjectOverviewView> {
  const [project, amenities] = await Promise.all([
    repo.getProject(),
    repo.getAmenities(),
  ]);
  return {
    project,
    advantages: amenities.filter((a) => a.category === "living"),
  };
}
