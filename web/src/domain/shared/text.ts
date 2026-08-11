/** Collapses sanitized CMS HTML to plain text for card summaries and meta
 *  descriptions. Pure, dependency-free — safe in every layer. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // &amp; — последним: иначе двойное экранирование (&amp;lt;) декодируется дважды
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** How far back we are willing to walk to the previous word boundary before
 *  giving up and cutting mid-word (pathologically long words). */
const WORD_BACKTRACK_LIMIT = 40;

/**
 * Обрезает текст до `max` символов по границе слова и добавляет «…».
 * ≤ max — возвращается как есть. Если ближайший пробел дальше 40 символов
 * от точки среза (сверхдлинное «слово») — жёсткий срез. Хвостовая пунктуация
 * перед многоточием убирается. Pure — используется для meta description.
 */
export function truncateAtWord(text: string, max = 160): string {
  const source = text.trim();
  if (source.length <= max) return source;

  let cut = source.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace !== -1 && max - lastSpace <= WORD_BACKTRACK_LIMIT) {
    cut = cut.slice(0, lastSpace);
  }
  cut = cut.replace(/[\s.,;:!?…()«»"'—–-]+$/u, "");
  return `${cut}…`;
}
