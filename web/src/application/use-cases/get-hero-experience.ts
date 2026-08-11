import { DomainError } from "@/domain";
import type { AudienceSegment } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

/** Serializable projection of a HeroChapter — safe to cross the RSC → client boundary. */
export interface HeroChapterView {
  id: string;
  eyebrow?: string;
  headline: string;
  subheadline: string;
  /** Normalized scroll window [from, to] ⊂ [0, 1]. */
  from: number;
  to: number;
  segment: AudienceSegment;
  cta?: { label: string; href: string };
}

export interface HeroMediaView {
  id: string;
  label: string;
  manifestUrl: string;
  poster: string;
  fallbackVideo: string;
  aspectRatio: number;
}

export interface HeroExperienceView {
  chapters: HeroChapterView[];
  /** Switchable scrub sources; first is the default. */
  variants: HeroMediaView[];
}

/**
 * Assembles the scroll-scrub hero: ordered, non-regressing chapter windows plus
 * the media descriptor, with the CMS banner override (copy of the intro
 * chapter, closing CTA, poster) merged on top. Guarantees the presentation
 * layer receives chapters sorted along the timeline — a broken authoring order
 * fails loudly here.
 */
export async function getHeroExperience(
  repo: ContentRepository,
): Promise<HeroExperienceView> {
  const [rawChapters, rawVariants, override] = await Promise.all([
    repo.getHeroChapters(),
    repo.getHeroVariants(),
    repo.getHeroOverride(),
  ]);

  const chapters = [...rawChapters].sort((a, b) => a.order - b.order);

  let previousFrom = -1;
  const views = chapters.map((chapter): HeroChapterView => {
    if (chapter.range.from < previousFrom) {
      throw new DomainError(
        `Hero chapter "${chapter.id}" starts at ${chapter.range.from}, before the previous chapter`,
      );
    }
    previousFrom = chapter.range.from;

    return {
      id: chapter.id,
      eyebrow: chapter.eyebrow,
      headline: chapter.headline,
      subheadline: chapter.subheadline,
      from: chapter.range.from,
      to: chapter.range.to,
      segment: chapter.segment,
      cta: chapter.cta,
    };
  });

  if (override && views.length > 0) {
    views[0] = {
      ...views[0],
      eyebrow: override.eyebrow ?? views[0].eyebrow,
      headline: override.headline ?? views[0].headline,
      subheadline: override.subheadline ?? views[0].subheadline,
    };
    if (override.cta) {
      // The banner CTA replaces the closing chapter's call to action.
      let target = views.length - 1;
      for (let i = views.length - 1; i >= 0; i -= 1) {
        if (views[i].cta) {
          target = i;
          break;
        }
      }
      views[target] = { ...views[target], cta: override.cta };
    }
  }

  if (rawVariants.length === 0) {
    throw new DomainError("Hero has no scrub variants configured");
  }

  const variants = rawVariants.map(
    (variant): HeroMediaView => ({
      id: variant.id,
      label: variant.label,
      manifestUrl: variant.manifestUrl,
      poster: variant.poster,
      fallbackVideo: variant.fallbackVideo,
      aspectRatio: variant.aspectRatio,
    }),
  );

  if (override?.poster) {
    // The CMS poster replaces the default variant's still only — the scrub
    // frame sequences always stay static.
    variants[0] = { ...variants[0], poster: override.poster };
  }

  return { chapters: views, variants };
}
