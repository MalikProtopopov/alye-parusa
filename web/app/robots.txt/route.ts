import { SITE_URL } from "@/presentation/lib/site-url";

/**
 * robots.txt как route handler: metadata-роут Next не умеет Clean-param —
 * а Яндексу он нужен, чтобы рекламные метки не плодили дубли в индексе.
 */
export const dynamic = "force-static";

const CLEAN_PARAMS =
  "utm_source&utm_medium&utm_campaign&utm_content&utm_term&gclid&yclid&ymclid&from";

export function GET(): Response {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: Yandex",
    "Allow: /",
    `Clean-param: ${CLEAN_PARAMS} /`,
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
