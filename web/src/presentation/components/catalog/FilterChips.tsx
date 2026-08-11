import Link from "next/link";
import type { PlanCategory } from "@/domain";
import { cn } from "@/presentation/lib/cn";
import styles from "./FilterChips.module.css";

/**
 * Server-rendered category filter: plain <Link> chips onto the SEO-friendly
 * one-segment routes /planirovki and /planirovki/{categorySlug}.
 */
export function FilterChips({
  categories,
  activeSlug,
}: {
  categories: PlanCategory[];
  activeSlug?: string | null;
}) {
  if (categories.length === 0) return null;
  return (
    <nav className={styles.chips} aria-label="Категории планировок">
      <Link
        href="/planirovki"
        className={cn(styles.chip, !activeSlug && styles.active)}
        aria-current={!activeSlug ? "page" : undefined}
      >
        Все
      </Link>
      {categories.map((category) => {
        const active = category.slug === activeSlug;
        return (
          <Link
            key={category.id}
            href={`/planirovki/${category.slug}`}
            className={cn(styles.chip, active && styles.active)}
            aria-current={active ? "page" : undefined}
          >
            {category.title}
          </Link>
        );
      })}
    </nav>
  );
}
