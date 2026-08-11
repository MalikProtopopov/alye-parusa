// Public surface of the domain layer. Depends on nothing outside this folder.
export { DomainError } from "./shared/domain-error";
export { stripHtml, truncateAtWord } from "./shared/text";
export { ScrollRange } from "./value-objects/scroll-range";

export type { AudienceSegment } from "./shared/audience-segment";
export type { Project, ProjectFact, GeoLocation } from "./entities/project";
export type { HeroChapter, HeroChapterCta, HeroOverride } from "./entities/hero-chapter";
export { SECTION_TEXT_KEYS } from "./entities/section-text";
export type { SectionText, SectionTextKey } from "./entities/section-text";
export type { FrameSequenceMedia, Flythrough, RenderImage } from "./entities/media";
export type { StoryBeat, ScrollStory } from "./entities/scroll-story";
export type { Amenity, AmenityCategory } from "./entities/amenity";
export type { FactChip } from "./entities/fact-chip";
export type { ApartmentProgram, FinishType } from "./entities/apartment";
export type { InvestmentMetric } from "./entities/investment";
export type { Brand, BrandRole } from "./entities/brand";
export type { AvailabilityStatus, Floorplan, PlanCategory } from "./entities/floorplan";
export type { NewsItem } from "./entities/news";
export type { SiteDocument, SiteDocumentType } from "./entities/site-document";
export type { FaqItem } from "./entities/faq";
export type { TeamMember } from "./entities/team";
export type { Partner } from "./entities/partner";
export type { SiteContacts } from "./entities/site-contacts";
export type { InstallmentParams, InstallmentQuote } from "./entities/installment";
export { calculateInstallment } from "./services/installment";
