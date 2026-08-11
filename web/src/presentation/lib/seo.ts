import type { Metadata } from "next";
import type { SeoMeta } from "@/application";
import { truncateAtWord } from "@/domain";
import { siteMeta } from "@/composition/container";
import { SITE_NAME } from "./site-url";

/** Дефолтная OG-обложка (генерируется scripts/generate-icons.mjs). */
export const DEFAULT_OG_IMAGE = "/og-cover.png";
export const DEFAULT_OG_WIDTH = 1200;
export const DEFAULT_OG_HEIGHT = 630;

/** CMS-запись SEO для страницы (порт SiteMetaRepository). */
export type PageSeo = SeoMeta;

export interface PageMetadataInput {
  /** SEO record key, e.g. "/planirovki". */
  slug: string;
  /** Fallback-заголовок БЕЗ суффикса бренда — его добавит title.template. */
  fallbackTitle: string;
  fallbackDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  /** Канонический путь страницы — обязателен. */
  canonicalPath: string;
  ogType?: "website" | "article";
  /** Только для ogType "article". ISO datetime. */
  publishedTime?: string;
  /** Только для ogType "article". ISO datetime. */
  modifiedTime?: string;
  noindex?: boolean;
}

/**
 * Чистая сборка Metadata из CMS-записи SEO + статических фолбэков.
 * CMS-title — абсолютный (админ пишет заголовок целиком); fallback-title идёт
 * под шаблон layout «%s — Алые Паруса». Описание обрезается по слову до 160.
 */
export function composeMetadata(seo: PageSeo | null, input: PageMetadataInput): Metadata {
  const cmsTitle = seo?.title?.trim() || null;
  const titleText = cmsTitle ?? input.fallbackTitle;

  const rawDescription = seo?.description?.trim() || input.fallbackDescription;
  const description = rawDescription ? truncateAtWord(rawDescription) : undefined;

  const image = seo?.ogImageUrl ?? input.ogImage;
  const ogImage = image
    ? { url: image, ...(input.ogImageAlt ? { alt: input.ogImageAlt } : {}) }
    : {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_WIDTH,
        height: DEFAULT_OG_HEIGHT,
        alt: input.ogImageAlt ?? SITE_NAME,
      };

  const ogType = input.ogType ?? "website";
  const noindex = Boolean(seo?.noindex || input.noindex);

  return {
    title: cmsTitle ? { absolute: cmsTitle } : input.fallbackTitle,
    ...(description ? { description } : {}),
    alternates: { canonical: input.canonicalPath },
    openGraph: {
      type: ogType,
      locale: "ru_RU",
      siteName: SITE_NAME,
      url: input.canonicalPath,
      title: titleText,
      ...(description ? { description } : {}),
      images: [ogImage],
      ...(ogType === "article"
        ? {
            ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      ...(description ? { description } : {}),
      images: [ogImage.url],
    },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * Метаданные страницы: CMS SEO (GET /seo?slug=…) поверх статических фолбэков.
 * Сборка никогда не зависит от доступности бекенда.
 */
export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  let seo: PageSeo | null = null;
  try {
    seo = await siteMeta.seo(input.slug);
  } catch {
    /* adapter already degrades; belt-and-braces */
  }
  return composeMetadata(seo, input);
}
