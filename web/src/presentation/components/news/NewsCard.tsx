import Link from "next/link";
import type { NewsItem } from "@/domain";
import { formatDateRu } from "@/presentation/lib/format";
import { SafeImage } from "../primitives/SafeImage";
import styles from "./NewsCard.module.css";

export function NewsCard({ item }: { item: NewsItem }) {
  const date = formatDateRu(item.publishedAt);

  return (
    <Link href={`/novosti/${item.slug}`} className={styles.card}>
      <div className={styles.media}>
        <SafeImage
          src={item.coverImageUrl}
          alt={`Обложка новости «${item.title}»`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={styles.img}
        />
      </div>
      <div className={styles.body}>
        {date ? (
          <time className={styles.date} dateTime={item.publishedAt ?? undefined}>
            {date}
          </time>
        ) : null}
        <h3 className={styles.title}>{item.title}</h3>
        {item.excerpt ? <p className={styles.excerpt}>{item.excerpt}</p> : null}
      </div>
    </Link>
  );
}
