import type { MetadataRoute } from "next";
import type { Floorplan, NewsItem, PlanCategory, SiteDocument } from "@/domain";
import { absoluteUrl } from "./site-url";

/**
 * Чистая сборка sitemap: реальные lastmod из updated_at, дедуп слагов
 * категория/планировка (категория выигрывает — зеркало резолвинга роута),
 * исключение noindex-страниц. Тестируется vitest'ом без Next.
 */

export interface SitemapSource {
  categories: PlanCategory[];
  floorplans: Floorplan[];
  news: NewsItem[];
  documents: SiteDocument[];
  /** Пути с noindex=true (GET /seo/noindex) — их в sitemap не публикуем. */
  noindexed: string[];
}

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

interface Entry {
  path: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/** Максимальная валидная дата из ISO-строк или undefined. */
function maxDate(values: Array<string | null | undefined | Date>): Date | undefined {
  let max: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (!Number.isFinite(time)) continue;
    if (max === null || time > max) max = time;
  }
  return max === null ? undefined : new Date(max);
}

export function buildSitemapEntries(source: SitemapSource): MetadataRoute.Sitemap {
  const noindexed = new Set(source.noindexed);
  const entries: Entry[] = [];

  // Категории публикуются первыми: при совпадении слага роут отдаёт категорию.
  const categorySlugs = new Set(source.categories.map((category) => category.slug));

  for (const category of source.categories) {
    entries.push({
      path: `/planirovki/${category.slug}`,
      lastModified: maxDate([category.updatedAt]),
      changeFrequency: "daily",
      priority: 0.8,
    });
  }

  for (const floorplan of source.floorplans) {
    if (categorySlugs.has(floorplan.slug)) continue; // категория выигрывает
    entries.push({
      path: `/planirovki/${floorplan.slug}`,
      lastModified: maxDate([floorplan.updatedAt]),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const item of source.news) {
    entries.push({
      path: `/novosti/${item.slug}`,
      lastModified: maxDate([item.publishedAt, item.updatedAt]),
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const document of source.documents) {
    entries.push({
      path: `/dokumenty/${document.slug}`,
      lastModified: maxDate([document.updatedAt]),
      changeFrequency: "monthly",
      priority: 0.3,
    });
  }

  // Спискам — max их детей, главной — max всего сайта.
  const catalogLastMod = maxDate([
    ...source.categories.map((c) => c.updatedAt),
    ...source.floorplans.map((f) => f.updatedAt),
  ]);
  const newsLastMod = maxDate(
    source.news.flatMap((n) => [n.publishedAt, n.updatedAt]),
  );
  const documentsLastMod = maxDate(source.documents.map((d) => d.updatedAt));
  const homeLastMod = maxDate([catalogLastMod, newsLastMod, documentsLastMod]);

  const listEntries: Entry[] = [
    { path: "/", lastModified: homeLastMod, changeFrequency: "weekly", priority: 1 },
    {
      path: "/planirovki",
      lastModified: catalogLastMod,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      path: "/novosti",
      lastModified: newsLastMod,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      path: "/dokumenty",
      lastModified: documentsLastMod,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  return [...listEntries, ...entries]
    .filter((entry) => !noindexed.has(entry.path))
    .map(({ path, lastModified, changeFrequency, priority }) => ({
      url: absoluteUrl(path),
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    }));
}
