export interface FaqItem {
  id: string;
  question: string;
  /** Sanitized HTML from the CMS editor. */
  answerHtml: string;
}
