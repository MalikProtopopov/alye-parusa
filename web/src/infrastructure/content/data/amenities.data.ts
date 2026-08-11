import type { Amenity } from "@/domain";

export const amenities: Amenity[] = [
  {
    id: "city-in-city",
    title: "Город в городе",
    description:
      "Замкнутая инфраструктура квартала: всё для жизни — в пределах пешей прогулки.",
    category: "living",
  },
  {
    id: "school",
    title: "Школа и детский сад",
    description: "Образование рядом с домом — школа в 8 минутах.",
    category: "living",
  },
  {
    id: "promenade",
    title: "Аллея 750 метров",
    description: "Центральный пешеходный бульвар через весь квартал к морю.",
    category: "living",
  },
  {
    id: "management",
    title: "Управляющая компания",
    description: "Сервис, обслуживание и аренда апартаментов под ключ.",
    category: "living",
  },
  {
    id: "pools",
    title: "Два бассейна",
    description: "Открытые бассейны у корпусов и на набережной.",
    category: "leisure",
  },
  {
    id: "beach",
    title: "Пляж первой линии",
    description: "Собственный выход к морю и песчаный пляж.",
    category: "leisure",
  },
  {
    id: "pier",
    title: "Набережная и пирс",
    description: "Прогулочная набережная, пирс и озеро внутри квартала.",
    category: "leisure",
  },
  {
    id: "commerce",
    title: "Коммерция у дома",
    description: "Рестораны, кофейни, аптеки и сервисы на первых этажах.",
    category: "infrastructure",
  },
  {
    id: "boulevard",
    title: "Бульвар и зелёные дворы",
    description: "Благоустроенные дворы без машин и прогулочные зоны.",
    category: "infrastructure",
  },
];
