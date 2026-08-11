import { describe, expect, it } from "vitest";
import type { Floorplan, NewsItem, PlanCategory, SiteDocument } from "@/domain";
import { buildSitemapEntries } from "@/presentation/lib/sitemap";
import { SITE_URL } from "@/presentation/lib/site-url";

function makeCategory(overrides: Partial<PlanCategory> = {}): PlanCategory {
  return {
    id: "cat-1",
    title: "Студии",
    slug: "studii",
    descriptionHtml: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeFloorplan(overrides: Partial<Floorplan> = {}): Floorplan {
  return {
    id: "fp-1",
    title: "Студия 22",
    slug: "studiya-22",
    descriptionHtml: null,
    areaM2: 22,
    price: null,
    availability: "available",
    floor: null,
    ceilingHeight: null,
    imageUrl: null,
    category: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeNews(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: "n-1",
    title: "Новость",
    slug: "novost",
    excerpt: null,
    bodyHtml: "<p>Текст</p>",
    coverImageUrl: null,
    publishedAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function makeDocument(overrides: Partial<SiteDocument> = {}): SiteDocument {
  return {
    id: "d-1",
    title: "Политика",
    slug: "politika",
    docType: "policy",
    descriptionHtml: null,
    fileUrl: null,
    url: null,
    isPolicy: true,
    updatedAt: null,
    ...overrides,
  };
}

const EMPTY = { categories: [], floorplans: [], news: [], documents: [], noindexed: [] };

describe("buildSitemapEntries", () => {
  it("без CMS-данных отдаёт статический минимум из четырёх страниц", () => {
    const entries = buildSitemapEntries(EMPTY);
    expect(entries.map((e) => e.url)).toEqual([
      `${SITE_URL}/`,
      `${SITE_URL}/planirovki`,
      `${SITE_URL}/novosti`,
      `${SITE_URL}/dokumenty`,
    ]);
    // дат нет — фиктивный lastModified не публикуем
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("lastModified");
    }
  });

  it("дедуп слага: категория выигрывает у планировки (зеркало роутинга)", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      categories: [makeCategory({ slug: "studii" })],
      floorplans: [
        makeFloorplan({ slug: "studii" }), // конфликт — планировка проигрывает
        makeFloorplan({ id: "fp-2", slug: "lux-79" }),
      ],
    });
    const catalogEntries = entries.filter((e) =>
      e.url.startsWith(`${SITE_URL}/planirovki/`),
    );
    expect(catalogEntries.map((e) => e.url)).toEqual([
      `${SITE_URL}/planirovki/studii`,
      `${SITE_URL}/planirovki/lux-79`,
    ]);
    expect(catalogEntries[0].priority).toBe(0.8); // категорийный приоритет
  });

  it("lastModified: у новости max(publishedAt, updatedAt), списки и главная — max детей", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      floorplans: [makeFloorplan({ updatedAt: "2026-06-01T00:00:00Z" })],
      news: [
        makeNews({
          publishedAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        }),
        makeNews({ id: "n-2", slug: "staraya", publishedAt: "2026-05-01T00:00:00Z" }),
      ],
    });
    const byUrl = new Map(entries.map((e) => [e.url, e]));

    expect(byUrl.get(`${SITE_URL}/novosti/novost`)?.lastModified).toEqual(
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(byUrl.get(`${SITE_URL}/novosti/staraya`)?.lastModified).toEqual(
      new Date("2026-05-01T00:00:00Z"),
    );
    // спискам — максимум их детей
    expect(byUrl.get(`${SITE_URL}/novosti`)?.lastModified).toEqual(
      new Date("2026-08-01T00:00:00Z"),
    );
    expect(byUrl.get(`${SITE_URL}/planirovki`)?.lastModified).toEqual(
      new Date("2026-06-01T00:00:00Z"),
    );
    // главной — максимум всего сайта
    expect(byUrl.get(`${SITE_URL}/`)?.lastModified).toEqual(
      new Date("2026-08-01T00:00:00Z"),
    );
    // документы без дат — без lastModified
    expect(byUrl.get(`${SITE_URL}/dokumenty`)).not.toHaveProperty("lastModified");
  });

  it("исключает noindex-пути — и детальные, и списковые", () => {
    const entries = buildSitemapEntries({
      ...EMPTY,
      news: [makeNews({ slug: "skrytaya" })],
      documents: [makeDocument()],
      noindexed: ["/novosti/skrytaya", "/dokumenty"],
    });
    const urls = entries.map((e) => e.url);
    expect(urls).not.toContain(`${SITE_URL}/novosti/skrytaya`);
    expect(urls).not.toContain(`${SITE_URL}/dokumenty`);
    expect(urls).toContain(`${SITE_URL}/dokumenty/politika`); // сам документ остаётся
  });
});
