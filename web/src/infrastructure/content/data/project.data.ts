import type { Project } from "@/domain";

/**
 * Real figures from the project brief (see ../../../../content/*.md and
 * project memory). Single source of truth for identity + headline facts.
 */
export const project: Project = {
  name: "Алые Паруса",
  wordmark: "АЛЫЕ ПАРУСА",
  tagline: "Апарт-комплекс на первой береговой линии Каспийского моря",
  kind: "апарт-комплекс",
  location: {
    region: "Республика Дагестан",
    district: "Карабудахкентский район",
    landmark: "напротив аэропорта Махачкалы",
    seaLine: "первая береговая линия Каспийского моря",
  },
  cadastralNumber: "05:09:000045:476",
  facts: [
    { id: "buildings", value: "46", label: "корпусов" },
    { id: "hectares", value: "11", label: "гектаров", detail: "площадь квартала" },
    { id: "promenade", value: "750 м", label: "центральная аллея" },
    { id: "floors", value: "9", label: "этажей" },
    { id: "areas", value: "22–79", label: "м² · апартаменты" },
    { id: "sea-line", value: "1-я", label: "линия у моря" },
  ],
};
