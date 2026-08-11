import type { PublicationsRepository } from "@/application";
import type { FaqItem, NewsItem, Partner, SiteDocument, TeamMember } from "@/domain";

import { apiFetch } from "./api-client";
import type { DocumentDto, FaqDto, NewsDto, PartnerDto, TeamMemberDto } from "./dto";
import {
  activeSorted,
  documentFromDto,
  faqFromDto,
  newsFromDto,
  partnerFromDto,
  teamMemberFromDto,
} from "./mappers";

const NEWS = { revalidate: 300, tags: ["news"] };
const DOCUMENTS = { revalidate: 3600, tags: ["documents"] };
const CONTENT = { revalidate: 300, tags: ["content"] };

/** CMS editorial-content adapter. Lists never throw (empty results hide
 *  sections); slug lookups propagate ApiUnavailableError. */
export class ApiPublicationsRepository implements PublicationsRepository {
  async listNews(): Promise<NewsItem[]> {
    try {
      const rows = await apiFetch<NewsDto[]>("/news", NEWS);
      return rows ? activeSorted(rows).map(newsFromDto) : [];
    } catch {
      return [];
    }
  }

  /** 404 → null (честный notFound); сеть/5xx пробрасываются (ApiUnavailableError). */
  async getNewsBySlug(slug: string): Promise<NewsItem | null> {
    const row = await apiFetch<NewsDto>(`/news/${encodeURIComponent(slug)}`, NEWS);
    return row ? newsFromDto(row) : null;
  }

  async listDocuments(): Promise<SiteDocument[]> {
    try {
      const rows = await apiFetch<DocumentDto[]>("/documents", DOCUMENTS);
      return rows ? activeSorted(rows).map(documentFromDto) : [];
    } catch {
      return [];
    }
  }

  /** 404 → null (честный notFound); сеть/5xx пробрасываются (ApiUnavailableError). */
  async getDocumentBySlug(slug: string): Promise<SiteDocument | null> {
    const row = await apiFetch<DocumentDto>(
      `/documents/${encodeURIComponent(slug)}`,
      DOCUMENTS,
    );
    return row ? documentFromDto(row) : null;
  }

  async getPolicyDocument(): Promise<SiteDocument | null> {
    try {
      const row = await apiFetch<DocumentDto>("/policy-document", DOCUMENTS);
      return row ? documentFromDto(row) : null;
    } catch {
      return null;
    }
  }

  async listFaq(): Promise<FaqItem[]> {
    try {
      const rows = await apiFetch<FaqDto[]>("/faq", CONTENT);
      return rows ? activeSorted(rows).map(faqFromDto) : [];
    } catch {
      return [];
    }
  }

  async listTeam(): Promise<TeamMember[]> {
    try {
      const rows = await apiFetch<TeamMemberDto[]>("/team", CONTENT);
      return rows ? activeSorted(rows).map(teamMemberFromDto) : [];
    } catch {
      return [];
    }
  }

  async listPartners(): Promise<Partner[]> {
    try {
      const rows = await apiFetch<PartnerDto[]>("/partners", CONTENT);
      return rows ? activeSorted(rows).map(partnerFromDto) : [];
    } catch {
      return [];
    }
  }
}
