import type { SiteContacts } from "@/domain";

export interface SeoMeta {
  slug: string;
  title: string | null;
  description: string | null;
  ogImageUrl: string | null;
  /** Страница исключается из индекса (robots noindex + вне sitemap). */
  noindex: boolean;
}

/** Счётчик Метрики + коды верификации вебмастеров из настроек CMS. */
export interface AnalyticsInfo {
  metrikaId: string | null;
  yandexVerification: string | null;
  googleVerification: string | null;
}

/** Which optional site sections the admin has switched on. */
export interface FeatureFlags {
  news: boolean;
  faq: boolean;
  advantages: boolean;
  partners: boolean;
  team: boolean;
  documents: boolean;
  calculator: boolean;
  seoAdmin: boolean;
}

/**
 * Outbound port for site-wide metadata: contacts, SEO, analytics, features,
 * redirects. Adapters must degrade gracefully (null / defaults) — never throw.
 */
export interface SiteMetaRepository {
  getContacts(): Promise<SiteContacts | null>;
  getSeo(slug: string): Promise<SeoMeta | null>;
  getAnalytics(): Promise<AnalyticsInfo>;
  getFeatures(): Promise<FeatureFlags>;
  /** Пути (slug) страниц с noindex — для исключения из sitemap. Ошибки → []. */
  getNoindexedPaths(): Promise<string[]>;
  /** 301-назначение для промахнувшегося пути или null. Ошибки → null. */
  resolveRedirect(path: string): Promise<string | null>;
}
