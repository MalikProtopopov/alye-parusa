// Адрес публичного сайта и якоря его секций — для ссылок «На сайте ↗».

export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Ключ текста секции → путь с якорем на публичном сайте.
// Якоря сверены с web/src/presentation/components/sections/*.tsx;
// секции без собственного id (ленты, скролл-история) ведут на главную.
export const SECTION_ANCHORS: Record<string, string> = {
  identity: "/",
  about: "/#about",
  trust_band: "/",
  location: "/#location",
  nearby_band: "/",
  infrastructure: "/#infrastructure",
  scroll_story: "/",
  residences: "/#residences",
  investment: "/#invest",
  cta: "/#contact",
  floorplans: "/#floorplans",
  calculator: "/#calculator",
  news: "/#news",
  team: "/#team",
  faq: "/#faq",
  partners: "/#partners",
};
