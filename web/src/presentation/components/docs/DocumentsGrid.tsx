import type { SiteDocument } from "@/domain";
import { Reveal } from "../primitives/Reveal";
import { DocumentCard } from "./DocumentCard";
import styles from "./DocumentsGrid.module.css";

export function DocumentsGrid({ documents }: { documents: SiteDocument[] }) {
  if (documents.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Раздел наполняется</p>
        <p className={styles.emptyText}>
          Разрешительная документация и проектные материалы появятся здесь в
          ближайшее время.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {documents.map((document, index) => (
        <Reveal key={document.id} delay={(index % 2) * 60}>
          <DocumentCard document={document} />
        </Reveal>
      ))}
    </div>
  );
}
