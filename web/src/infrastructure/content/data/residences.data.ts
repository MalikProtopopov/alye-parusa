import type { ApartmentProgram, FinishType } from "@/domain";

export const apartmentProgram: ApartmentProgram = {
  buildings: 46,
  floors: 9,
  minAreaM2: 22,
  maxAreaM2: 79,
  landHectares: 11,
  promenadeMeters: 750,
};

export const finishTypes: FinishType[] = [
  {
    id: "shell",
    name: "Черновая",
    description: "Под собственный дизайн-проект и полную свободу планировки.",
  },
  {
    id: "white-box",
    name: "White Box",
    description: "Стены, стяжка и разводка готовы — остаётся финишная отделка.",
  },
  {
    id: "turnkey",
    name: "Готовый ремонт",
    description: "Заезжай и живи или сдавай — апартамент готов под ключ.",
  },
];
