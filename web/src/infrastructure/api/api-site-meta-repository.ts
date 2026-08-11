import type {
  AnalyticsInfo,
  FeatureFlags,
  SeoMeta,
  SiteMetaRepository,
} from "@/application";
import type { SiteContacts } from "@/domain";

import { apiFetch } from "./api-client";
import type {
  AnalyticsDto,
  ContactsDto,
  FeaturesDto,
  RedirectDto,
  SeoMetaDto,
} from "./dto";
import { analyticsFromDto, contactsFromDto, featuresFromDto, seoFromDto } from "./mappers";

const META = { revalidate: 300, tags: ["meta"] };
const ANALYTICS = { revalidate: 3600, tags: ["meta"] };
const REDIRECTS = { revalidate: 300, tags: ["redirects"] };

const NO_ANALYTICS: AnalyticsInfo = {
  metrikaId: null,
  yandexVerification: null,
  googleVerification: null,
};

/** With no reachable backend every feature stays on — the sections hide
 *  themselves anyway when their lists come back empty. */
const DEFAULT_FEATURES: FeatureFlags = {
  news: true,
  faq: true,
  advantages: true,
  partners: true,
  team: true,
  documents: true,
  calculator: true,
  seoAdmin: true,
};

export class ApiSiteMetaRepository implements SiteMetaRepository {
  async getContacts(): Promise<SiteContacts | null> {
    try {
      const dto = await apiFetch<ContactsDto>("/contacts", META);
      return dto ? contactsFromDto(dto) : null;
    } catch {
      return null;
    }
  }

  async getSeo(slug: string): Promise<SeoMeta | null> {
    try {
      const dto = await apiFetch<SeoMetaDto>("/seo", {
        ...META,
        searchParams: { slug },
      });
      return dto ? seoFromDto(dto) : null;
    } catch {
      return null;
    }
  }

  async getAnalytics(): Promise<AnalyticsInfo> {
    try {
      const dto = await apiFetch<AnalyticsDto>("/analytics", ANALYTICS);
      return dto ? analyticsFromDto(dto) : NO_ANALYTICS;
    } catch {
      return NO_ANALYTICS;
    }
  }

  async getFeatures(): Promise<FeatureFlags> {
    try {
      const dto = await apiFetch<FeaturesDto>("/features", META);
      return dto ? featuresFromDto(dto) : DEFAULT_FEATURES;
    } catch {
      return DEFAULT_FEATURES;
    }
  }

  /** Best effort: старый бекенд без эндпоинта (404 → null) или сеть → []. */
  async getNoindexedPaths(): Promise<string[]> {
    try {
      const rows = await apiFetch<string[]>("/seo/noindex", ANALYTICS);
      return rows ?? [];
    } catch {
      return [];
    }
  }

  /** 404 (нет редиректа) и любые сбои → null: страница живёт своей жизнью. */
  async resolveRedirect(path: string): Promise<string | null> {
    try {
      const dto = await apiFetch<RedirectDto>("/redirects/resolve", {
        ...REDIRECTS,
        searchParams: { path },
      });
      return dto?.to_path ?? null;
    } catch {
      return null;
    }
  }
}
