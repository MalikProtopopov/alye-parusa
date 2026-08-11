import type { SectionText, SectionTextKey } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

/** CMS-editable heading block of a landing section (with static fallback). */
export async function getSectionText(
  repo: ContentRepository,
  key: SectionTextKey,
): Promise<SectionText> {
  return repo.getSectionText(key);
}
