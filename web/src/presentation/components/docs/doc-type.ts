import type { SiteDocumentType } from "@/domain";

export const DOC_TYPE_LABELS: Record<SiteDocumentType, string> = {
  permit: "Разрешительный документ",
  declaration: "Проектная декларация",
  policy: "Политика",
  link: "Внешняя ссылка",
  other: "Документ",
};
