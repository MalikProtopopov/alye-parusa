import type { AudienceSegment } from "../shared/audience-segment";
import type { ScrollRange } from "../value-objects/scroll-range";

export interface HeroChapterCta {
  label: string;
  href: string;
}

/**
 * One text overlay chapter of the scroll-scrubbed hero. Appears/disappears as
 * the scroll progress enters/leaves `range`. Text is NEVER baked into the
 * video — it lives here and is rendered as an HTML layer.
 */
export interface HeroChapter {
  id: string;
  order: number;
  eyebrow?: string;
  headline: string;
  subheadline: string;
  range: ScrollRange;
  segment: AudienceSegment;
  cta?: HeroChapterCta;
}

/**
 * CMS banner override for the hero: replaces the intro chapter's copy, the
 * closing CTA and the poster still. Every field is optional — absent fields
 * keep the statically authored values.
 */
export interface HeroOverride {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  cta?: HeroChapterCta;
  secondaryCta?: HeroChapterCta;
  poster?: string;
}
