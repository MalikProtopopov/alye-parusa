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

import { amenities } from "./data/amenities.data";
import { brands } from "./data/brands.data";
import { proximity, trustSignals } from "./data/fact-bands.data";
import { scrollStory } from "./data/scroll-story.data";
import { heroChapters } from "./data/hero-chapters.data";
import { heroVariants, flythroughs, renders } from "./data/media.data";
import { investmentMetrics, investmentNarrative } from "./data/investment.data";
import { project } from "./data/project.data";
import { apartmentProgram, finishTypes } from "./data/residences.data";
import { sectionTexts } from "./data/section-texts.data";

/**
 * In-memory adapter backed by typed data modules. The guaranteed-available
 * fallback behind ApiContentRepository — and a complete implementation on its
 * own, so the site renders pixel-identical with no backend at all.
 */
export class StaticContentRepository implements ContentRepository {
  async getProject(): Promise<Project> {
    return project;
  }

  async getHeroChapters(): Promise<HeroChapter[]> {
    return heroChapters;
  }

  async getHeroVariants(): Promise<FrameSequenceMedia[]> {
    return heroVariants;
  }

  async getHeroOverride(): Promise<HeroOverride | null> {
    return null;
  }

  async getAmenities(): Promise<Amenity[]> {
    return amenities;
  }

  async getApartmentProgram(): Promise<ApartmentProgram> {
    return apartmentProgram;
  }

  async getFinishTypes(): Promise<FinishType[]> {
    return finishTypes;
  }

  async getInvestmentMetrics(): Promise<InvestmentMetric[]> {
    return investmentMetrics;
  }

  async getInvestmentNarrative(): Promise<string[]> {
    return investmentNarrative;
  }

  async getFlythroughs(): Promise<Flythrough[]> {
    return flythroughs;
  }

  async getRenders(): Promise<RenderImage[]> {
    return renders;
  }

  async getBrands(): Promise<Brand[]> {
    return brands;
  }

  async getTrustSignals(): Promise<FactChip[]> {
    return trustSignals;
  }

  async getProximity(): Promise<FactChip[]> {
    return proximity;
  }

  async getScrollStory(): Promise<ScrollStory> {
    return scrollStory;
  }

  async getSectionText(key: SectionTextKey): Promise<SectionText> {
    return sectionTexts[key];
  }
}
