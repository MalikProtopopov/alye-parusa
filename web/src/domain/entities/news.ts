export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  /** Sanitized HTML from the CMS editor. */
  bodyHtml: string;
  coverImageUrl: string | null;
  /** ISO datetime or null when unpublished/undated. */
  publishedAt: string | null;
  /** ISO datetime of the last CMS edit, or null (older backend). */
  updatedAt: string | null;
}
