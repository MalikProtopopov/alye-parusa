/**
 * Единый источник происхождения сайта для metadata, sitemap, robots и JSON-LD.
 * NEXT_PUBLIC_SITE_URL задаётся на билде (Docker: обязательный build-arg).
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alyeparusa.example"
).replace(/\/+$/, "");

export const SITE_NAME = "Алые Паруса";

/** Абсолютный URL страницы/ассета сайта из пути вида "/planirovki/studio". */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
