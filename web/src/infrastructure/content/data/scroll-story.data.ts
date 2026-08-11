import type { ScrollStory } from "@/domain";

/** Cinematic "жизнь у моря" interlude — F1 fly-through (aerial → waterfront)
 *  scrubbed by scroll, three beats sliding in from alternating sides. */
export const scrollStory: ScrollStory = {
  manifestUrl: "/media/story/frames/manifest.json",
  poster: "/media/story/poster.jpg",
  eyebrow: "Жизнь у моря",
  beats: [
    {
      id: "morning",
      side: "left",
      title: "Утро начинается с моря",
      text: "Первая береговая линия — пляж прямо за порогом.",
      from: 0.02,
      to: 0.4,
    },
    {
      id: "day",
      side: "right",
      title: "День — как на курорте",
      text: "Два бассейна, набережная, бульвар и пирс на озере.",
      from: 0.36,
      to: 0.72,
    },
    {
      id: "evening",
      side: "left",
      title: "Вечером — свой город",
      text: "Кафе, огни и прогулки по аллее длиной 750 метров.",
      from: 0.68,
      to: 0.99,
    },
  ],
};
