import type { FactChip } from "@/domain";

/**
 * Investor credibility strip.
 * ⚠️ LEGAL: the escrow / 214-ФЗ wording and apartment legal status must be
 * confirmed with the developer's lawyers before publishing — apart-status is
 * nuanced. Edit values here once verified.
 */
export const trustSignals: FactChip[] = [
  { id: "escrow", label: "Защита средств", value: "Эскроу · 214-ФЗ" },
  { id: "cadastre", label: "Кадастр участка", value: "05:09:000045:476" },
  { id: "developer", label: "Застройщик", value: "Cherkesov Group" },
  { id: "architecture", label: "Архитектура", value: "бюро ФОРМА" },
  { id: "tech", label: "Технология", value: "кирпич-монолит" },
];

/**
 * Family walkability strip — ONLY verified/known figures. Do NOT invent minutes;
 * measure off the master-plan before adding пирс / супермаркет / мечеть times.
 */
export const proximity: FactChip[] = [
  { id: "school", label: "Школа", value: "8 минут" },
  { id: "kindergarten", label: "Детский сад", value: "8 минут" },
  { id: "beach", label: "Пляж", value: "первая линия" },
  { id: "alley", label: "Аллея", value: "750 метров" },
  { id: "airport", label: "Аэропорт", value: "напротив" },
];
