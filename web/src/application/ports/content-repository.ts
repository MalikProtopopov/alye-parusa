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

/**
 * Outbound port (hexagonal): the application depends on this interface, never
 * on a concrete data source. Adapters live in the infrastructure layer.
 * All reads are async — content may come from the CMS API with a static
 * in-memory fallback.
 */
export interface ContentRepository {
  getProject(): Promise<Project>;
  getHeroChapters(): Promise<HeroChapter[]>;
  /** One or more scrub sources the visitor can switch between in the hero. */
  getHeroVariants(): Promise<FrameSequenceMedia[]>;
  /** CMS banner override for the hero copy/CTA/poster; null = no override. */
  getHeroOverride(): Promise<HeroOverride | null>;
  getAmenities(): Promise<Amenity[]>;
  getApartmentProgram(): Promise<ApartmentProgram>;
  getFinishTypes(): Promise<FinishType[]>;
  getInvestmentMetrics(): Promise<InvestmentMetric[]>;
  getInvestmentNarrative(): Promise<string[]>;
  getFlythroughs(): Promise<Flythrough[]>;
  getRenders(): Promise<RenderImage[]>;
  getBrands(): Promise<Brand[]>;
  getTrustSignals(): Promise<FactChip[]>;
  getProximity(): Promise<FactChip[]>;
  getScrollStory(): Promise<ScrollStory>;
  /** CMS-editable heading block of a landing section. */
  getSectionText(key: SectionTextKey): Promise<SectionText>;
}
