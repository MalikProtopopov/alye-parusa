import type { ScrollStory } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export async function getScrollStory(repo: ContentRepository): Promise<ScrollStory> {
  return repo.getScrollStory();
}
