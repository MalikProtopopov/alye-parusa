/**
 * Normalizes CMS media URLs for rendering from the site's own origin:
 *   "/media/uploads/x.jpg" → "/cms-media/uploads/x.jpg"  (next.config rewrite)
 *   "http(s)://…"          → as is (covered by images.remotePatterns)
 * Pure — safe on server and client.
 */
export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | null;
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/media/")) return `/cms-media/${url.slice("/media/".length)}`;
  if (url.startsWith("media/")) return `/cms-media/${url.slice("media/".length)}`;
  return url;
}
