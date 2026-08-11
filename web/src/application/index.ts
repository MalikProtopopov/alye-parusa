// Public surface of the application layer.
export type { ContentRepository } from "./ports/content-repository";
export type { CatalogRepository } from "./ports/catalog-repository";
export type { PublicationsRepository } from "./ports/publications-repository";
export type {
  SiteMetaRepository,
  SeoMeta,
  AnalyticsInfo,
  FeatureFlags,
} from "./ports/site-meta-repository";

export { getHeroExperience } from "./use-cases/get-hero-experience";
export type {
  HeroExperienceView,
  HeroChapterView,
  HeroMediaView,
} from "./use-cases/get-hero-experience";

export { getProjectOverview } from "./use-cases/get-project-overview";
export type { ProjectOverviewView } from "./use-cases/get-project-overview";

export { getLocationStory } from "./use-cases/get-location-story";
export type { LocationStoryView } from "./use-cases/get-location-story";

export { getInfrastructure } from "./use-cases/get-infrastructure";
export type { InfrastructureView } from "./use-cases/get-infrastructure";

export { getResidences } from "./use-cases/get-residences";
export type { ResidencesView } from "./use-cases/get-residences";

export { getInvestmentCase } from "./use-cases/get-investment-case";
export type { InvestmentCaseView } from "./use-cases/get-investment-case";

export { getContact } from "./use-cases/get-contact";
export type { ContactView } from "./use-cases/get-contact";

export { getTrustSignals, getProximity } from "./use-cases/get-fact-bands";

export { getScrollStory } from "./use-cases/get-scroll-story";

export { getSectionText } from "./use-cases/get-section-text";

export { getCatalog, getFeaturedFloorplans, getFloorplan } from "./use-cases/get-catalog";
export type { CatalogView } from "./use-cases/get-catalog";

export { getCalculatorParams, installmentTeaser } from "./use-cases/get-calculator";

export {
  getNewsList,
  getNewsItem,
  getDocumentsList,
  getDocumentItem,
  getPolicyDocument,
  getFaqList,
  getTeamList,
  getPartnersList,
} from "./use-cases/get-publications";

export {
  getSiteContacts,
  getSeoMeta,
  getAnalytics,
  getFeatureFlags,
  getNoindexedPaths,
  resolveRedirect,
} from "./use-cases/get-site-meta";
