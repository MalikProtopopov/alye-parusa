import { describe, expect, it } from "vitest";
import { getHeroExperience } from "@/application";
import type { ContentRepository } from "@/application";
import { ScrollRange } from "@/domain";
import type { FrameSequenceMedia, HeroChapter, HeroOverride } from "@/domain";

const media: FrameSequenceMedia = {
  id: "day-night",
  label: "День → Ночь",
  manifestUrl: "/m.json",
  poster: "/p.jpg",
  fallbackVideo: "/v.mp4",
  aspectRatio: 16 / 9,
};

/** Minimal fake adapter — only the methods getHeroExperience touches matter. */
function repoWith(
  chapters: HeroChapter[],
  override: HeroOverride | null = null,
): ContentRepository {
  const nyi = () => {
    throw new Error("not implemented in fake");
  };
  return {
    getProject: nyi,
    getHeroChapters: async () => chapters,
    getHeroVariants: async () => [media],
    getHeroOverride: async () => override,
    getAmenities: async () => [],
    getApartmentProgram: nyi,
    getFinishTypes: async () => [],
    getInvestmentMetrics: async () => [],
    getInvestmentNarrative: async () => [],
    getFlythroughs: async () => [],
    getRenders: async () => [],
    getBrands: async () => [],
    getTrustSignals: async () => [],
    getProximity: async () => [],
    getScrollStory: async () => ({
      manifestUrl: "",
      poster: "",
      eyebrow: "",
      beats: [],
    }),
    getSectionText: nyi,
  };
}

const chapter = (id: string, order: number, from: number, to: number): HeroChapter => ({
  id,
  order,
  headline: id,
  subheadline: "",
  range: ScrollRange.of(from, to),
  segment: "intro",
});

describe("getHeroExperience", () => {
  it("sorts chapters by order and flattens their ranges", async () => {
    const repo = repoWith([chapter("b", 1, 0.4, 0.7), chapter("a", 0, 0.0, 0.4)]);

    const { chapters, variants } = await getHeroExperience(repo);

    expect(chapters.map((c) => c.id)).toEqual(["a", "b"]);
    expect(chapters[0].from).toBe(0);
    expect(chapters[1].to).toBe(0.7);
    expect(variants[0].aspectRatio).toBeCloseTo(16 / 9);
    expect(variants[0].id).toBe("day-night");
  });

  it("throws when the authored order regresses along the timeline", async () => {
    // order a(0) → b(1), but b starts before a on the scroll timeline
    const repo = repoWith([chapter("a", 0, 0.5, 0.8), chapter("b", 1, 0.1, 0.3)]);

    await expect(getHeroExperience(repo)).rejects.toThrow();
  });

  it("merges the banner override into the intro chapter, CTA and poster", async () => {
    const withCta: HeroChapter = {
      ...chapter("z", 1, 0.5, 1),
      cta: { label: "Старый CTA", href: "#old" },
    };
    const repo = repoWith([chapter("a", 0, 0, 0.5), withCta], {
      headline: "Из баннера",
      cta: { label: "Новый CTA", href: "#contact" },
      poster: "/cms-media/banner.jpg",
    });

    const { chapters, variants } = await getHeroExperience(repo);

    expect(chapters[0].headline).toBe("Из баннера");
    expect(chapters[0].subheadline).toBe(""); // absent fields keep static copy
    expect(chapters[1].cta).toEqual({ label: "Новый CTA", href: "#contact" });
    expect(variants[0].poster).toBe("/cms-media/banner.jpg");
  });
});
