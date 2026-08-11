// Composition root (server-only). The ONLY place infrastructure is wired to the
// application. Everything downstream depends on abstractions, not this module.
import {
  getCalculatorParams,
  getCatalog,
  getContact,
  getDocumentItem,
  getDocumentsList,
  getFaqList,
  getFeatureFlags,
  getFeaturedFloorplans,
  getFloorplan,
  getHeroExperience,
  getInfrastructure,
  getInvestmentCase,
  getAnalytics,
  getLocationStory,
  getNewsItem,
  getNoindexedPaths,
  getNewsList,
  getPartnersList,
  getPolicyDocument,
  getProjectOverview,
  getProximity,
  getResidences,
  getScrollStory,
  getSectionText,
  getSeoMeta,
  getSiteContacts,
  getTeamList,
  getTrustSignals,
  installmentTeaser,
  resolveRedirect,
} from "@/application";
import type {
  CatalogRepository,
  ContentRepository,
  PublicationsRepository,
  SiteMetaRepository,
} from "@/application";
import type { SectionTextKey } from "@/domain";
import {
  ApiCatalogRepository,
  ApiContentRepository,
  ApiPublicationsRepository,
  ApiSiteMetaRepository,
  StaticContentRepository,
} from "@/infrastructure";

const repository: ContentRepository = new ApiContentRepository(
  new StaticContentRepository(),
);
const catalogRepository: CatalogRepository = new ApiCatalogRepository();
const publicationsRepository: PublicationsRepository = new ApiPublicationsRepository();
const siteMetaRepository: SiteMetaRepository = new ApiSiteMetaRepository();

/** Bound use-cases — the presentation layer's single entry point to content. */
export const content = {
  heroExperience: () => getHeroExperience(repository),
  projectOverview: () => getProjectOverview(repository),
  locationStory: () => getLocationStory(repository),
  infrastructure: () => getInfrastructure(repository),
  residences: () => getResidences(repository),
  investmentCase: () => getInvestmentCase(repository),
  contact: () => getContact(repository),
  trustSignals: () => getTrustSignals(repository),
  proximity: () => getProximity(repository),
  scrollStory: () => getScrollStory(repository),
  sectionText: (key: SectionTextKey) => getSectionText(repository, key),
};

/** Floorplan catalog + installment settings. */
export const catalog = {
  overview: (categorySlug?: string) => getCatalog(catalogRepository, categorySlug),
  featured: (limit?: number) => getFeaturedFloorplans(catalogRepository, limit),
  floorplan: (slug: string) => getFloorplan(catalogRepository, slug),
  calculatorParams: () => getCalculatorParams(catalogRepository),
  /** «от N ₽/мес» teaser for a price, or null when the calculator is not set up. */
  installmentTeaser: async (price: number | null) => {
    if (price === null) return null;
    const params = await getCalculatorParams(catalogRepository);
    return params ? installmentTeaser(params, price) : null;
  },
};

/** Editorial content: news, documents, FAQ, team, partners. */
export const publications = {
  news: () => getNewsList(publicationsRepository),
  newsItem: (slug: string) => getNewsItem(publicationsRepository, slug),
  documents: () => getDocumentsList(publicationsRepository),
  documentItem: (slug: string) => getDocumentItem(publicationsRepository, slug),
  policy: () => getPolicyDocument(publicationsRepository),
  faq: () => getFaqList(publicationsRepository),
  team: () => getTeamList(publicationsRepository),
  partners: () => getPartnersList(publicationsRepository),
};

/** Site-wide metadata: contacts, SEO, analytics, feature flags, redirects. */
export const siteMeta = {
  contacts: () => getSiteContacts(siteMetaRepository),
  seo: (slug: string) => getSeoMeta(siteMetaRepository, slug),
  analytics: () => getAnalytics(siteMetaRepository),
  features: () => getFeatureFlags(siteMetaRepository),
  noindexedPaths: () => getNoindexedPaths(siteMetaRepository),
  resolveRedirect: (path: string) => resolveRedirect(siteMetaRepository, path),
};
