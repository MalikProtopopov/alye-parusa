import { DomainError } from "@/domain";
import type { Flythrough, GeoLocation } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface LocationStoryView {
  location: GeoLocation;
  points: string[];
  /** F1: descent from aerial to the waterfront — the location's establishing shot. */
  flythrough: Flythrough;
}

const AERIAL_FLYTHROUGH_ID = "f1-aerial-to-waterfront";

export async function getLocationStory(
  repo: ContentRepository,
): Promise<LocationStoryView> {
  const [flythroughs, project] = await Promise.all([
    repo.getFlythroughs(),
    repo.getProject(),
  ]);

  const flythrough =
    flythroughs.find((f) => f.id === AERIAL_FLYTHROUGH_ID) ?? flythroughs[0];
  if (!flythrough) {
    throw new DomainError("No flythrough available for the location story");
  }

  const { region, district, landmark, seaLine } = project.location;

  return {
    location: { region, district, landmark, seaLine },
    points: [seaLine, landmark, `${region}, ${district}`],
    flythrough,
  };
}
