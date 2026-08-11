import Link from "next/link";
import { JsonLd } from "@/presentation/components/seo/JsonLd";
import { breadcrumbsJsonLd } from "@/presentation/lib/structured-data";
import styles from "./Breadcrumbs.module.css";

export interface Crumb {
  label: string;
  /** Absent on the current (last) crumb. */
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav className={styles.nav} aria-label="Хлебные крошки">
      <JsonLd data={breadcrumbsJsonLd(items)} />
      <ol className={styles.list}>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className={styles.item}>
            {item.href ? (
              <Link href={item.href} className={styles.link}>
                {item.label}
              </Link>
            ) : (
              <span className={styles.current} aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
