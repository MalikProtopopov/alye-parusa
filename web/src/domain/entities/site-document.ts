export type SiteDocumentType = "permit" | "declaration" | "policy" | "link" | "other";

export interface SiteDocument {
  id: string;
  title: string;
  slug: string;
  docType: SiteDocumentType;
  /** Sanitized HTML from the CMS editor. */
  descriptionHtml: string | null;
  /** Uploaded file (PDF etc.) — mutually complementary with `url`. */
  fileUrl: string | null;
  /** External link documents. */
  url: string | null;
  isPolicy: boolean;
  /** ISO datetime of the last CMS edit, or null (older backend). */
  updatedAt: string | null;
}
