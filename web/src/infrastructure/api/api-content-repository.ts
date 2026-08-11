import type { ContentRepository } from "@/application";
import type {
  Amenity,
  ApartmentProgram,
  Brand,
  FactChip,
  FinishType,
  Flythrough,
  FrameSequenceMedia,
  HeroChapter,
  HeroOverride,
  InvestmentMetric,
  Project,
  RenderImage,
  ScrollStory,
  SectionText,
  SectionTextKey,
} from "@/domain";

import type { StaticContentRepository } from "../content/static-content-repository";
import { apiFetch } from "./api-client";
import type {
  AdvantageDto,
  BannerDto,
  FactDto,
  FactGroupDto,
  HeroChapterDto,
  SiteTextDto,
} from "./dto";
import {
  activeSorted,
  advantageToAmenity,
  factToChip,
  factToInvestmentMetric,
  factToProjectFact,
} from "./mappers";
import { mediaUrl } from "./media-url";

const CONTENT = { revalidate: 300, tags: ["content"] };

const trimmed = (value: string | null | undefined): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};

/**
 * CMS-backed ContentRepository. Every method degrades per-call to the static
 * adapter, so a dead backend can never break the page — it just renders the
 * authored fallback (which the backend seed mirrors 1:1).
 *
 * Scrub manifests/frames, the scroll story, renders, fly-throughs and the
 * apartment program are ALWAYS static: they are build artefacts of the media
 * pipeline, not CMS content.
 */
export class ApiContentRepository implements ContentRepository {
  constructor(private readonly fallback: StaticContentRepository) {}

  private async facts(group: FactGroupDto): Promise<FactDto[]> {
    const rows = await apiFetch<FactDto[]>("/facts", CONTENT);
    return rows ? activeSorted(rows).filter((row) => row.group === group) : [];
  }

  async getProject(): Promise<Project> {
    const base = await this.fallback.getProject();
    try {
      const [facts, identity] = await Promise.all([
        this.facts("about"),
        apiFetch<SiteTextDto>("/site-texts/identity", CONTENT),
      ]);
      const name = trimmed(identity?.title) ?? base.name;
      return {
        ...base,
        name,
        wordmark: name.toUpperCase(),
        kind: trimmed(identity?.eyebrow) ?? base.kind,
        tagline: trimmed(identity?.lead) ?? base.tagline,
        facts: facts.length > 0 ? facts.map(factToProjectFact) : base.facts,
      };
    } catch {
      return base;
    }
  }

  async getHeroChapters(): Promise<HeroChapter[]> {
    const base = await this.fallback.getHeroChapters();
    try {
      const rows = await apiFetch<HeroChapterDto[]>("/hero-chapters", CONTENT);
      if (!rows) return base;
      const active = activeSorted(rows);
      // Scroll windows are authored statically; the CMS edits copy only. A
      // mismatched chapter count cannot be zipped — use the static set whole.
      if (active.length !== base.length) return base;
      return base.map((chapter, i) => ({
        ...chapter,
        eyebrow: trimmed(active[i].eyebrow) ?? chapter.eyebrow,
        headline: trimmed(active[i].title) ?? chapter.headline,
        subheadline: trimmed(active[i].subtitle) ?? chapter.subheadline,
      }));
    } catch {
      return base;
    }
  }

  async getHeroVariants(): Promise<FrameSequenceMedia[]> {
    return this.fallback.getHeroVariants();
  }

  async getHeroOverride(): Promise<HeroOverride | null> {
    try {
      const banner = await apiFetch<BannerDto>("/banner", CONTENT);
      if (!banner) return null;
      const override: HeroOverride = {};
      const eyebrow = trimmed(banner.eyebrow);
      const headline = trimmed(banner.title);
      const subheadline = trimmed(banner.subtitle);
      if (eyebrow) override.eyebrow = eyebrow;
      if (headline) override.headline = headline;
      if (subheadline) override.subheadline = subheadline;
      const ctaLabel = trimmed(banner.cta_primary_label);
      const ctaTarget = trimmed(banner.cta_primary_target);
      if (ctaLabel && ctaTarget) override.cta = { label: ctaLabel, href: ctaTarget };
      const secondaryLabel = trimmed(banner.cta_secondary_label);
      const secondaryTarget = trimmed(banner.cta_secondary_target);
      if (secondaryLabel && secondaryTarget) {
        override.secondaryCta = { label: secondaryLabel, href: secondaryTarget };
      }
      const poster = trimmed(banner.background_url);
      if (poster) override.poster = mediaUrl(poster);
      return Object.keys(override).length > 0 ? override : null;
    } catch {
      return null;
    }
  }

  async getAmenities(): Promise<Amenity[]> {
    const base = await this.fallback.getAmenities();
    try {
      const rows = await apiFetch<AdvantageDto[]>("/advantages", CONTENT);
      if (!rows) return base;
      const active = activeSorted(rows);
      return active.length > 0 ? active.map(advantageToAmenity) : base;
    } catch {
      return base;
    }
  }

  async getApartmentProgram(): Promise<ApartmentProgram> {
    return this.fallback.getApartmentProgram();
  }

  async getFinishTypes(): Promise<FinishType[]> {
    return this.fallback.getFinishTypes();
  }

  async getInvestmentMetrics(): Promise<InvestmentMetric[]> {
    const base = await this.fallback.getInvestmentMetrics();
    try {
      const facts = await this.facts("investment");
      return facts.length > 0 ? facts.map(factToInvestmentMetric) : base;
    } catch {
      return base;
    }
  }

  async getInvestmentNarrative(): Promise<string[]> {
    return this.fallback.getInvestmentNarrative();
  }

  async getFlythroughs(): Promise<Flythrough[]> {
    return this.fallback.getFlythroughs();
  }

  async getRenders(): Promise<RenderImage[]> {
    return this.fallback.getRenders();
  }

  async getBrands(): Promise<Brand[]> {
    return this.fallback.getBrands();
  }

  async getTrustSignals(): Promise<FactChip[]> {
    const base = await this.fallback.getTrustSignals();
    try {
      const facts = await this.facts("trust");
      return facts.length > 0 ? facts.map(factToChip) : base;
    } catch {
      return base;
    }
  }

  async getProximity(): Promise<FactChip[]> {
    const base = await this.fallback.getProximity();
    try {
      const facts = await this.facts("nearby");
      return facts.length > 0 ? facts.map(factToChip) : base;
    } catch {
      return base;
    }
  }

  async getScrollStory(): Promise<ScrollStory> {
    return this.fallback.getScrollStory();
  }

  async getSectionText(key: SectionTextKey): Promise<SectionText> {
    const base = await this.fallback.getSectionText(key);
    try {
      const row = await apiFetch<SiteTextDto>(`/site-texts/${key}`, CONTENT);
      if (!row || !row.active) return base;
      return {
        key,
        eyebrow: trimmed(row.eyebrow) ?? base.eyebrow,
        title: trimmed(row.title) ?? base.title,
        lead: trimmed(row.lead) ?? base.lead,
      };
    } catch {
      return base;
    }
  }
}
