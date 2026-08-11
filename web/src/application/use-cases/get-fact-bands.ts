import type { FactChip } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

/** Investor credibility strip. */
export async function getTrustSignals(repo: ContentRepository): Promise<FactChip[]> {
  return repo.getTrustSignals();
}

/** Family walkability strip. */
export async function getProximity(repo: ContentRepository): Promise<FactChip[]> {
  return repo.getProximity();
}
