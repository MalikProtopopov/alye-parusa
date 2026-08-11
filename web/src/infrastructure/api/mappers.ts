import type {
  Amenity,
  FactChip,
  FaqItem,
  Floorplan,
  InstallmentParams,
  InvestmentMetric,
  NewsItem,
  Partner,
  PlanCategory,
  ProjectFact,
  SiteContacts,
  SiteDocument,
  TeamMember,
} from "@/domain";
import { stripHtml } from "@/domain";
import type { AnalyticsInfo, SeoMeta, FeatureFlags } from "@/application";
import type {
  AdvantageDto,
  AnalyticsDto,
  CalculatorParamsDto,
  ContactsDto,
  DocumentDto,
  FactDto,
  FaqDto,
  FeaturesDto,
  FloorplanDto,
  NewsDto,
  NumericDto,
  PartnerDto,
  PlanCategoryDto,
  SeoMetaDto,
  TeamMemberDto,
} from "./dto";
import { mediaUrl } from "./media-url";

/** Numeric(…) columns may arrive as number or string — coerce once, here. */
export function toNumber(value: NumericDto): number {
  return typeof value === "number" ? value : Number(value);
}

export function toNumberOrNull(value: NumericDto | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = toNumber(value);
  return Number.isFinite(n) ? n : null;
}

/** Public lists come unordered enough — keep only active rows, honour sort. */
export function activeSorted<T extends { active: boolean; sort: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.active).sort((a, b) => a.sort - b.sort);
}

export function factToProjectFact(dto: FactDto): ProjectFact {
  return {
    id: dto.id,
    value: dto.value,
    label: dto.label,
    detail: dto.note ?? undefined,
  };
}

export function factToChip(dto: FactDto): FactChip {
  return { id: dto.id, label: dto.label, value: dto.value };
}

export function factToInvestmentMetric(dto: FactDto): InvestmentMetric {
  return {
    id: dto.id,
    value: dto.value,
    label: dto.label,
    note: dto.note ?? undefined,
  };
}

export function advantageToAmenity(dto: AdvantageDto): Amenity {
  return {
    id: dto.id,
    title: dto.title,
    description: stripHtml(dto.text),
    category: dto.category ?? "living",
  };
}

export function planCategoryFromDto(dto: PlanCategoryDto): PlanCategory {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    descriptionHtml: dto.description ?? null,
    updatedAt: dto.updated_at ?? null,
  };
}

export function floorplanFromDto(dto: FloorplanDto): Floorplan {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    descriptionHtml: dto.description,
    areaM2: toNumber(dto.area_m2),
    price: toNumberOrNull(dto.price),
    availability: dto.availability_status,
    floor: dto.floor,
    ceilingHeight: toNumberOrNull(dto.ceiling_height),
    imageUrl: mediaUrl(dto.image_url),
    category: dto.category
      ? { id: dto.category.id, title: dto.category.title, slug: dto.category.slug }
      : null,
    updatedAt: dto.updated_at ?? null,
  };
}

export function newsFromDto(dto: NewsDto): NewsItem {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    excerpt: dto.excerpt,
    bodyHtml: dto.body,
    coverImageUrl: mediaUrl(dto.cover_image_url),
    publishedAt: dto.published_at,
    updatedAt: dto.updated_at ?? null,
  };
}

export function documentFromDto(dto: DocumentDto): SiteDocument {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    docType: dto.doc_type,
    descriptionHtml: dto.description,
    fileUrl: mediaUrl(dto.file_url),
    url: dto.url,
    isPolicy: dto.is_policy,
    updatedAt: dto.updated_at ?? null,
  };
}

export function faqFromDto(dto: FaqDto): FaqItem {
  return { id: dto.id, question: dto.question, answerHtml: dto.answer };
}

export function teamMemberFromDto(dto: TeamMemberDto): TeamMember {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.role,
    photoUrl: mediaUrl(dto.photo_url),
    bio: dto.bio,
  };
}

export function partnerFromDto(dto: PartnerDto): Partner {
  return {
    id: dto.id,
    name: dto.name,
    logoUrl: mediaUrl(dto.logo_url),
    url: dto.url,
    description: dto.description,
  };
}

export function contactsFromDto(dto: ContactsDto): SiteContacts {
  return {
    phone: dto.phone,
    email: dto.email,
    telegram: dto.telegram,
    whatsapp: dto.whatsapp,
    address: dto.address,
    workHours: dto.work_hours,
    mapEmbed: dto.map_embed,
    inn: dto.inn,
    ogrn: dto.ogrn,
    cadastralNumber: dto.cadastral_number,
  };
}

export function seoFromDto(dto: SeoMetaDto): SeoMeta {
  return {
    slug: dto.slug,
    title: dto.title,
    description: dto.description,
    ogImageUrl: mediaUrl(dto.og_image_url),
    noindex: dto.noindex ?? false,
  };
}

export function analyticsFromDto(dto: AnalyticsDto): AnalyticsInfo {
  return {
    metrikaId: dto.metrika_id,
    yandexVerification: dto.yandex_verification ?? null,
    googleVerification: dto.google_verification ?? null,
  };
}

export function featuresFromDto(dto: FeaturesDto): FeatureFlags {
  return {
    news: dto.news,
    faq: dto.faq,
    advantages: dto.advantages,
    partners: dto.partners,
    team: dto.team,
    documents: dto.documents,
    calculator: dto.calculator,
    seoAdmin: dto.seo_admin,
  };
}

export function calculatorParamsFromDto(dto: CalculatorParamsDto): InstallmentParams {
  return {
    minDownPaymentPct: toNumber(dto.min_down_payment_pct),
    maxDownPaymentPct: toNumber(dto.max_down_payment_pct),
    termMinMonths: dto.term_min_months,
    termMaxMonths: dto.term_max_months,
    termStepMonths: dto.term_step_months,
    markupPctAnnual: toNumber(dto.markup_pct_annual),
    pricePerM2: toNumberOrNull(dto.price_per_m2),
    disclaimer: dto.disclaimer,
  };
}
