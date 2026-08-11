/**
 * Wire mirrors of the backend's Pydantic Out-schemas (prefix /api/v1).
 * The ONLY place contract drift can happen — keep in sync with backend/app/schemas.py.
 * Numeric columns may arrive as number OR string → coerce in mappers.ts.
 */

export type NumericDto = number | string;

export interface PlanCategoryDto {
  id: string;
  title: string;
  slug: string;
  /** Sanitized HTML or null. Absent on the previous backend revision. */
  description?: string | null;
  active: boolean;
  sort: number;
  /** Absent on the previous backend revision. */
  updated_at?: string | null;
}

export type AvailabilityStatusDto = "available" | "reserved" | "sold";

export interface FloorplanDto {
  id: string;
  title: string;
  slug: string;
  /** Sanitized HTML or null. */
  description: string | null;
  area_m2: NumericDto;
  /** null also when prices are hidden site-wide. */
  price: NumericDto | null;
  availability_status: AvailabilityStatusDto;
  floor: number | null;
  ceiling_height: NumericDto | null;
  image_url: string | null;
  active: boolean;
  sort: number;
  category_id: string | null;
  category: { id: string; title: string; slug: string } | null;
  created_at: string;
  updated_at: string;
}

export type DocTypeDto = "permit" | "declaration" | "policy" | "link" | "other";

export interface DocumentDto {
  id: string;
  title: string;
  slug: string;
  doc_type: DocTypeDto;
  /** Sanitized HTML or null. */
  description: string | null;
  file_url: string | null;
  url: string | null;
  is_policy: boolean;
  active: boolean;
  sort: number;
  /** Absent on the previous backend revision. */
  updated_at?: string | null;
}

export interface NewsDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  /** Sanitized HTML. */
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
  active: boolean;
  sort: number;
  /** Absent on the previous backend revision. */
  updated_at?: string | null;
}

export interface FaqDto {
  id: string;
  question: string;
  /** Sanitized HTML. */
  answer: string;
  active: boolean;
  sort: number;
}

export type AdvantageCategoryDto = "living" | "leisure" | "infrastructure";

export interface AdvantageDto {
  id: string;
  title: string;
  /** Sanitized HTML. */
  text: string;
  image_url: string | null;
  category: AdvantageCategoryDto | null;
  active: boolean;
  sort: number;
}

export interface PartnerDto {
  id: string;
  name: string;
  logo_url: string | null;
  url: string | null;
  description: string | null;
  active: boolean;
  sort: number;
}

export interface TeamMemberDto {
  id: string;
  name: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
  sort: number;
}

export type FactGroupDto = "about" | "trust" | "nearby" | "investment";

export interface FactDto {
  id: string;
  group: FactGroupDto;
  value: string;
  label: string;
  note: string | null;
  active: boolean;
  sort: number;
}

export interface SiteTextDto {
  id: string;
  key: string;
  eyebrow: string | null;
  title: string | null;
  lead: string | null;
  active: boolean;
  sort: number;
}

export interface HeroChapterDto {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  active: boolean;
  sort: number;
}

export interface BannerDto {
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  cta_primary_label: string | null;
  cta_primary_target: string | null;
  cta_secondary_label: string | null;
  cta_secondary_target: string | null;
  background_url: string | null;
}

export interface ContactsDto {
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  address: string | null;
  work_hours: string | null;
  map_embed: string | null;
  inn: string | null;
  ogrn: string | null;
  cadastral_number: string | null;
}

export interface SeoMetaDto {
  slug: string;
  title: string | null;
  description: string | null;
  og_image_url: string | null;
  /** Absent on the previous backend revision. */
  noindex?: boolean;
}

export interface AnalyticsDto {
  metrika_id: string | null;
  /** Verification codes — absent on the previous backend revision. */
  yandex_verification?: string | null;
  google_verification?: string | null;
}

/** GET /redirects/resolve?path=… → 200 with the pair, or 404 (no redirect). */
export interface RedirectDto {
  from_path: string;
  to_path: string;
}

export interface FeaturesDto {
  news: boolean;
  faq: boolean;
  advantages: boolean;
  partners: boolean;
  team: boolean;
  documents: boolean;
  calculator: boolean;
  seo_admin: boolean;
}

/** Shares of 0..1, NOT percentages (0.30 = 30 %). */
export interface CalculatorParamsDto {
  min_down_payment_pct: NumericDto;
  max_down_payment_pct: NumericDto;
  term_min_months: number;
  term_max_months: number;
  term_step_months: number;
  markup_pct_annual: NumericDto;
  price_per_m2: NumericDto | null;
  disclaimer: string | null;
}

export interface CalcRequestDto {
  mode: "floorplan" | "amount";
  floorplan_id?: string;
  amount?: number;
  down_payment_pct?: number;
  months?: number;
}

export interface CalcResultDto {
  price: number;
  down_payment_pct: number;
  down_payment: number;
  financed: number;
  months: number;
  markup_pct_annual: number;
  markup: number;
  monthly_payment: number;
  total_cost: number;
  disclaimer: string | null;
}

export type LeadKindDto = "simple_callback" | "floorplan" | "with_calc" | "without_calc";

export interface LeadCreateDto {
  name: string;
  phone: string;
  kind: LeadKindDto;
  floorplan_id?: string;
  message?: string;
  consent_given: true;
  consent_text?: string;
  utm?: Record<string, string>;
  source_button?: string;
  source_block?: string;
  page_url?: string;
  calc_snapshot?: { input: CalcRequestDto; result: CalcResultDto };
  /** Honeypot — must be sent empty by humans. */
  website: string;
}

export interface LeadCreatedDto {
  id: string;
  message: string;
}
