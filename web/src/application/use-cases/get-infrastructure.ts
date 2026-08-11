import type { Amenity, Flythrough } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface InfrastructureView {
  amenities: Amenity[];
  /** Ground-life fly-throughs (commercial street, waterfront) that intro the section. */
  flythroughs: Flythrough[];
}

const GROUND_FLYTHROUGH_IDS = new Set([
  "f2-commercial-to-beachfront",
  "f3-waterfront-to-beachfront",
]);

export async function getInfrastructure(
  repo: ContentRepository,
): Promise<InfrastructureView> {
  const [amenities, flythroughs] = await Promise.all([
    repo.getAmenities(),
    repo.getFlythroughs(),
  ]);
  return {
    amenities: amenities.filter(
      (a) => a.category === "leisure" || a.category === "infrastructure",
    ),
    flythroughs: flythroughs.filter((f) => GROUND_FLYTHROUGH_IDS.has(f.id)),
  };
}
