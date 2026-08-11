import type { NewsItem } from "@/domain";
import { formatDateRu } from "@/presentation/lib/format";
import { RichText } from "../primitives/RichText";
import { Reveal } from "../primitives/Reveal";
import { SafeImage } from "../primitives/SafeImage";
import styles from "./NewsArticle.module.css";

/** Body of a news page: dateline + cover plate + rich text. */
export function NewsArticle({ item }: { item: NewsItem }) {
  const date = formatDateRu(item.publishedAt);
  return (
    <article className={styles.article}>
      {item.publishedAt && date ? (
        <header className={styles.dateline}>
          <time dateTime={item.publishedAt}>{date}</time>
        </header>
      ) : null}
      {item.coverImageUrl ? (
        <Reveal variant="mask">
          <figure className={styles.cover}>
            <SafeImage
              src={item.coverImageUrl}
              alt={`Обложка новости «${item.title}»`}
              fill
              sizes="(min-width: 1024px) 60rem, 100vw"
              className={styles.img}
              priority
            />
          </figure>
        </Reveal>
      ) : null}
      <RichText html={item.bodyHtml} className={styles.body} />
    </article>
  );
}
