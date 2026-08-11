import type { InvestmentMetric } from "@/domain";

export const investmentMetrics: InvestmentMetric[] = [
  { id: "payback", value: "от 3 лет", label: "окупаемость" },
  {
    id: "management",
    value: "под ключ",
    label: "аренда через УК",
    note: "пассивный доход без забот",
  },
  {
    id: "demand",
    value: "1-я линия",
    label: "курортный спрос",
    note: "аренда круглый год",
  },
  {
    id: "entry",
    value: "от 22 м²",
    label: "порог входа",
    note: "компактные апартаменты",
  },
];

export const investmentNarrative: string[] = [
  "Апартаменты у моря — актив, который работает: сдача через управляющую компанию и рост капитализации по мере готовности квартала.",
  "Первая береговая линия Каспия и курортный формат обеспечивают спрос на аренду в течение всего года.",
];
