import type { SectionText, SectionTextKey } from "@/domain";

/**
 * Static heading blocks of the landing sections — the literals that used to
 * live in the JSX. Single fallback source when the CMS is unreachable; the
 * seed of the backend mirrors these values (site-texts), so the page renders
 * pixel-identical either way.
 */
export const sectionTexts: Record<SectionTextKey, SectionText> = {
  identity: {
    key: "identity",
    eyebrow: "апарт-комплекс",
    title: "Алые Паруса",
    lead: "Апарт-комплекс на первой береговой линии Каспийского моря",
  },
  about: {
    key: "about",
    eyebrow: "О комплексе",
    title: "Город у моря,\nпродуманный для жизни",
    lead: "Апарт-комплекс на первой береговой линии Каспийского моря",
  },
  trust_band: {
    key: "trust_band",
    title: "Надёжность",
  },
  location: {
    key: "location",
    eyebrow: "Локация",
    title: "Первая линия Каспия",
    lead: "Республика Дагестан, Карабудахкентский район",
  },
  nearby_band: {
    key: "nearby_band",
    title: "Всё рядом",
  },
  infrastructure: {
    key: "infrastructure",
    eyebrow: "Инфраструктура",
    title: "Курорт в двух шагах от дома",
    lead: "Всё для отдыха и жизни — внутри квартала, без машины.",
  },
  scroll_story: {
    key: "scroll_story",
    eyebrow: "Жизнь у моря",
    title: "Жизнь у моря",
  },
  residences: {
    key: "residences",
    eyebrow: "Апартаменты",
    title: "Форматы под жизнь и под доход",
    lead: "22–79 м² · 9 этажей · 3 варианта отделки",
  },
  floorplans: {
    key: "floorplans",
    eyebrow: "Каталог",
    title: "Планировки",
  },
  calculator: {
    key: "calculator",
    eyebrow: "Рассрочка",
    title: "Рассчитайте свой платёж",
  },
  investment: {
    key: "investment",
    eyebrow: "Инвестиции",
    title: "Актив у моря, который растёт",
  },
  news: {
    key: "news",
    eyebrow: "Новости",
    title: "Жизнь проекта",
  },
  team: {
    key: "team",
    eyebrow: "Команда",
    title: "Люди, которые строят город у моря",
  },
  faq: {
    key: "faq",
    eyebrow: "Вопросы",
    title: "Отвечаем на главное",
  },
  partners: {
    key: "partners",
    eyebrow: "Партнёры",
    title: "Кто создаёт «Алые Паруса»",
  },
  cta: {
    key: "cta",
    eyebrow: "Cherkesov Group",
    title: "Забронируйте апартамент у моря",
    lead: "Оставьте заявку — менеджер BUYHOUSE свяжется с вами и подберёт формат.",
  },
};
