import type { MetadataRoute } from "next";
import { catalog, publications, siteMeta } from "@/composition/container";
import { buildSitemapEntries } from "@/presentation/lib/sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // CMS slugs — best effort: an unreachable backend keeps the static minimum.
  let categories: Awaited<ReturnType<typeof catalog.overview>>["categories"] = [];
  let floorplans: Awaited<ReturnType<typeof catalog.overview>>["floorplans"] = [];
  let news: Awaited<ReturnType<typeof publications.news>> = [];
  let documents: Awaited<ReturnType<typeof publications.documents>> = [];
  let noindexed: string[] = [];

  try {
    [{ categories, floorplans }, news, documents, noindexed] = await Promise.all([
      catalog.overview(),
      publications.news(),
      publications.documents(),
      siteMeta.noindexedPaths(),
    ]);
  } catch {
    /* backend down — the static minimum still ships */
  }

  return buildSitemapEntries({ categories, floorplans, news, documents, noindexed });
}
