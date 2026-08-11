import { ScrollRange } from "@/domain";
import type { HeroChapter } from "@/domain";

/**
 * Overlay chapters synced to the hero morph (empty → foundations → frames →
 * day → sunset → night), scripted onto Grin's «Алые Паруса» arc: the shore that
 * waits → the miracle built by hand → the ship enters the bay → life → a dream
 * that also appreciates. Image and copy now say the same thing. Ranges stay
 * ordered by `from` (getHeroExperience enforces it).
 */
export const heroChapters: HeroChapter[] = [
  {
    id: "intro",
    order: 0,
    eyebrow: "Первая линия Каспия",
    headline: "Алые Паруса",
    subheadline: "Есть море. И есть тот, кто ждёт на берегу.",
    range: ScrollRange.of(0.0, 0.15),
    segment: "intro",
  },
  {
    id: "sea-start",
    order: 1,
    eyebrow: "Дагестан · напротив аэропорта",
    headline: "Здесь чудо строят руками",
    subheadline: "Кирпично-монолитные корпуса поднимаются у самой воды.",
    range: ScrollRange.of(0.15, 0.38),
    segment: "residence",
  },
  {
    id: "city-rises",
    order: 2,
    eyebrow: "Масштаб",
    headline: "Город вырастает на берегу",
    subheadline: "46 корпусов · 11 гектаров · аллея 750 метров",
    range: ScrollRange.of(0.38, 0.6),
    segment: "residence",
  },
  {
    id: "ready-home",
    order: 3,
    eyebrow: "Квартал готов",
    headline: "Корабль вошёл в бухту",
    subheadline: "9 этажей · апартаменты 22–79 м² · школа в 8 минутах",
    range: ScrollRange.of(0.6, 0.74),
    segment: "residence",
  },
  {
    id: "resort-living",
    order: 4,
    eyebrow: "Курорт",
    headline: "Курорт, в котором живут",
    subheadline: "Бульвар · два бассейна · пляж первой линии",
    range: ScrollRange.of(0.74, 0.88),
    segment: "residence",
  },
  {
    id: "growing-asset",
    order: 5,
    eyebrow: "Инвестиция",
    headline: "Мечта, которая растёт в цене",
    subheadline: "Аренда через управляющую компанию · окупаемость от 3 лет",
    range: ScrollRange.of(0.88, 1.0),
    segment: "investor",
    cta: { label: "Забронировать апартамент", href: "#contact" },
  },
];
