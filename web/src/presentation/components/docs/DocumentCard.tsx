import Link from "next/link";
import { stripHtml } from "@/domain";
import type { SiteDocument } from "@/domain";
import { DOC_TYPE_LABELS } from "./doc-type";
import styles from "./DocumentCard.module.css";

export function DocumentCard({ document }: { document: SiteDocument }) {
  const summary = document.descriptionHtml ? stripHtml(document.descriptionHtml) : null;

  return (
    <article className={styles.card}>
      <p className={styles.type}>{DOC_TYPE_LABELS[document.docType]}</p>
      <h3 className={styles.title}>
        {/* Stretched link: the whole card is the click target, while the
            download/external actions below stay separately clickable. */}
        <Link href={`/dokumenty/${document.slug}`} className={styles.titleLink}>
          {document.title}
        </Link>
      </h3>
      {summary ? <p className={styles.text}>{summary}</p> : null}
      <div className={styles.actions}>
        {document.fileUrl ? (
          <a className={styles.action} href={document.fileUrl} download>
            Скачать PDF<span aria-hidden="true"> ↓</span>
          </a>
        ) : null}
        {document.url ? (
          <a
            className={styles.action}
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Перейти<span aria-hidden="true"> →</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}
