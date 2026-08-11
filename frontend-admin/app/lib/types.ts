// Типы данных API «Алые Паруса» (соответствуют pydantic-схемам бэкенда).

export type Role = "admin" | "manager";

export interface Me {
  id: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
}

// ── Заявки ──────────────────────────────────────────────────────────
export type LeadStatus = "new" | "in_progress" | "done";
export type LeadKind =
  | "simple_callback"
  | "with_calc"
  | "without_calc"
  | "presentation"
  | "floorplan";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  kind: string;
  floorplan_id: string | null;
  floorplan_title?: string | null;
  message: string | null;
  consent_given: boolean;
  consent_at: string | null;
  ip_address: string | null;
  utm: Record<string, unknown> | null;
  source_button: string | null;
  source_block: string | null;
  page_url: string | null;
  calc_snapshot: Record<string, unknown> | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
}

// ── Планировки ──────────────────────────────────────────────────────
export type Availability = "available" | "reserved" | "sold";

// Категория планировок (студии / 1-комн. / 2-комн. …)
export interface PlanCategory {
  id: string;
  title: string;
  slug: string;
  sort: number;
  active: boolean;
  floorplans_count?: number;
}

export interface Floorplan {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  category: PlanCategory | null;
  description: string | null;
  area_m2: number;
  price: number | null;
  availability_status: Availability;
  floor: number | null;
  ceiling_height: number | null;
  image_url: string | null;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

// Тело для create/update (create — все обязательные, update — partial)
export interface FloorplanInput {
  title: string;
  slug: string;
  category_id?: string | null;
  description?: string | null;
  area_m2: number;
  price?: number | null;
  availability_status: Availability;
  floor?: number | null;
  ceiling_height?: number | null;
  image_url?: string | null;
  active: boolean;
  sort: number;
}

// ── Баннер ──────────────────────────────────────────────────────────
export interface Banner {
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  cta_primary_label: string | null;
  cta_primary_target: string | null;
  cta_secondary_label: string | null;
  cta_secondary_target: string | null;
  background_url: string | null;
}

// ── Контакты ────────────────────────────────────────────────────────
export interface Contacts {
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  address: string | null;
  cadastral_number: string | null;
  work_hours: string | null;
  map_embed: string | null;
  inn: string | null;
  ogrn: string | null;
}

// ── Настройки ───────────────────────────────────────────────────────
export interface Settings {
  show_prices: boolean;
  notify_channel: string; // "telegram" | "none" | "email"
  metrika_id: string | null;
  telegram_configured?: boolean; // read-only: заданы ли токен и chat_id на сервере
  yandex_verification?: string | null;
  google_verification?: string | null;
}

// ── Фичефлаги (публичный GET /api/v1/features) ──────────────────────
export interface FeatureFlags {
  news: boolean;
  faq: boolean;
  advantages: boolean;
  partners: boolean;
  team: boolean;
  documents: boolean;
  calculator: boolean;
  seo_admin: boolean;
}
