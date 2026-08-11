/** CMS-editable heading block of a landing section (site-texts in the admin). */
export const SECTION_TEXT_KEYS = [
  "identity",
  "about",
  "trust_band",
  "location",
  "nearby_band",
  "infrastructure",
  "scroll_story",
  "residences",
  "floorplans",
  "calculator",
  "investment",
  "news",
  "team",
  "faq",
  "partners",
  "cta",
] as const;

export type SectionTextKey = (typeof SECTION_TEXT_KEYS)[number];

export interface SectionText {
  key: SectionTextKey;
  eyebrow?: string;
  /** May contain "\n" — presentation renders it as a line break. */
  title: string;
  lead?: string;
}
