import type { FaqItem, NewsItem, Partner, SiteDocument, TeamMember } from "@/domain";

/**
 * Outbound port for editorial content: news, documents, FAQ, team, partners.
 * List adapters degrade to empty results (never throw). Slug lookups differ:
 * null strictly means «not found» (404); an unreachable backend propagates as
 * ApiUnavailableError so detail pages answer 5xx, not a soft 404.
 */
export interface PublicationsRepository {
  listNews(): Promise<NewsItem[]>;
  /** null ⇔ 404; сеть/5xx — throw (страница отдаёт честный 5xx). */
  getNewsBySlug(slug: string): Promise<NewsItem | null>;
  listDocuments(): Promise<SiteDocument[]>;
  /** null ⇔ 404; сеть/5xx — throw (страница отдаёт честный 5xx). */
  getDocumentBySlug(slug: string): Promise<SiteDocument | null>;
  /** The privacy-policy document the consent checkbox links to. */
  getPolicyDocument(): Promise<SiteDocument | null>;
  listFaq(): Promise<FaqItem[]>;
  listTeam(): Promise<TeamMember[]>;
  listPartners(): Promise<Partner[]>;
}
