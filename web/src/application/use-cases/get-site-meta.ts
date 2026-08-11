import type { SiteContacts } from "@/domain";
import type {
  AnalyticsInfo,
  FeatureFlags,
  SeoMeta,
  SiteMetaRepository,
} from "../ports/site-meta-repository";

export async function getSiteContacts(
  repo: SiteMetaRepository,
): Promise<SiteContacts | null> {
  return repo.getContacts();
}

export async function getSeoMeta(
  repo: SiteMetaRepository,
  slug: string,
): Promise<SeoMeta | null> {
  return repo.getSeo(slug);
}

export async function getAnalytics(repo: SiteMetaRepository): Promise<AnalyticsInfo> {
  return repo.getAnalytics();
}

export async function getFeatureFlags(repo: SiteMetaRepository): Promise<FeatureFlags> {
  return repo.getFeatures();
}

export async function getNoindexedPaths(repo: SiteMetaRepository): Promise<string[]> {
  return repo.getNoindexedPaths();
}

export async function resolveRedirect(
  repo: SiteMetaRepository,
  path: string,
): Promise<string | null> {
  return repo.resolveRedirect(path);
}
