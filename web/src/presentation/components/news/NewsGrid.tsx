import type { NewsItem } from "@/domain";
import { cn } from "@/presentation/lib/cn";
import { Reveal } from "../primitives/Reveal";
import { NewsCard } from "./NewsCard";
import styles from "./NewsGrid.module.css";

export function NewsGrid({
  items,
  spaced = false,
}: {
  items: NewsItem[];
  /** Adds top spacing when the grid follows a SectionHeading. */
  spaced?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className={cn(styles.empty, spaced && styles.spaced)}>
        <p className={styles.emptyTitle}>Новостей пока нет</p>
        <p className={styles.emptyText}>
          Скоро здесь появятся события проекта — следите за обновлениями.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(styles.grid, spaced && styles.spaced)}>
      {items.map((item, index) => (
        <Reveal key={item.id} delay={(index % 3) * 60}>
          <NewsCard item={item} />
        </Reveal>
      ))}
    </div>
  );
}
