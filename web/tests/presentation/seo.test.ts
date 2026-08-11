import { describe, expect, it } from "vitest";
import type { PageSeo } from "@/presentation/lib/seo";
import {
  DEFAULT_OG_IMAGE,
  composeMetadata,
} from "@/presentation/lib/seo";

const INPUT = {
  slug: "/novosti",
  fallbackTitle: "Новости",
  fallbackDescription: "Новости строительства и жизни комплекса.",
  canonicalPath: "/novosti",
};

function makeSeo(overrides: Partial<PageSeo> = {}): PageSeo {
  return {
    slug: "/novosti",
    title: null,
    description: null,
    ogImageUrl: null,
    noindex: false,
    ...overrides,
  };
}

describe("composeMetadata", () => {
  it("CMS-title — абсолютный (обходит title.template), fallback — под шаблон", () => {
    const cms = composeMetadata(makeSeo({ title: "SEO-заголовок из CMS" }), INPUT);
    expect(cms.title).toEqual({ absolute: "SEO-заголовок из CMS" });

    const fallback = composeMetadata(null, INPUT);
    expect(fallback.title).toBe("Новости");
  });

  it("canonical обязателен и попадает в alternates + og:url", () => {
    const meta = composeMetadata(null, INPUT);
    expect(meta.alternates?.canonical).toBe("/novosti");
    expect((meta.openGraph as { url?: string }).url).toBe("/novosti");
  });

  it("без ogImage подставляется дефолтная обложка 1200×630", () => {
    const meta = composeMetadata(null, INPUT);
    const images = (meta.openGraph as { images: Array<Record<string, unknown>> }).images;
    expect(images).toEqual([
      { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "Алые Паруса" },
    ]);
  });

  it("CMS og_image_url приоритетнее ogImage страницы", () => {
    const meta = composeMetadata(makeSeo({ ogImageUrl: "/cms-media/og.jpg" }), {
      ...INPUT,
      ogImage: "/local.jpg",
    });
    const images = (meta.openGraph as { images: Array<{ url: string }> }).images;
    expect(images[0].url).toBe("/cms-media/og.jpg");
  });

  it("twitter зеркалит title/description/картинку как summary_large_image", () => {
    const meta = composeMetadata(makeSeo({ description: "Описание из CMS" }), INPUT);
    const twitter = meta.twitter as {
      card: string;
      title: string;
      description: string;
      images: string[];
    };
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe("Новости");
    expect(twitter.description).toBe("Описание из CMS");
    expect(twitter.images).toEqual([DEFAULT_OG_IMAGE]);
  });

  it("noindex из CMS или input даёт robots {index:false, follow:false}", () => {
    expect(composeMetadata(makeSeo({ noindex: true }), INPUT).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(composeMetadata(null, { ...INPUT, noindex: true }).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(composeMetadata(makeSeo(), INPUT).robots).toBeUndefined();
  });

  it("description обрезается по слову до 160 символов с многоточием", () => {
    const long = `${"очень длинное описание ".repeat(20)}конец`;
    const meta = composeMetadata(null, { ...INPUT, fallbackDescription: long });
    expect(meta.description?.length).toBeLessThanOrEqual(161);
    expect(meta.description?.endsWith("…")).toBe(true);
    expect((meta.openGraph as { description?: string }).description).toBe(
      meta.description,
    );
  });

  it("article-тип прокидывает publishedTime/modifiedTime в openGraph", () => {
    const meta = composeMetadata(null, {
      ...INPUT,
      ogType: "article",
      publishedTime: "2026-07-01T09:00:00Z",
      modifiedTime: "2026-07-15T09:00:00Z",
    });
    const og = meta.openGraph as {
      type: string;
      publishedTime?: string;
      modifiedTime?: string;
    };
    expect(og.type).toBe("article");
    expect(og.publishedTime).toBe("2026-07-01T09:00:00Z");
    expect(og.modifiedTime).toBe("2026-07-15T09:00:00Z");
  });
});
