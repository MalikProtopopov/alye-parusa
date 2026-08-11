import type { ReactNode } from "react";
import { Container } from "../primitives/Container";
import { Breadcrumbs } from "./Breadcrumbs";
import type { Crumb } from "./Breadcrumbs";
import styles from "./PageIntro.module.css";

/**
 * Header of an internal page: breadcrumbs, folio + eyebrow kicker, the scarlet
 * waterline and the H1 — the drawing-sheet language of the section headings,
 * scaled to a page title.
 */
export function PageIntro({
  crumbs,
  folio,
  eyebrow,
  title,
  lead,
  children,
}: {
  crumbs?: Crumb[];
  /** Sheet index, e.g. "К-01". */
  folio?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className={styles.intro}>
      <Container>
        {crumbs && crumbs.length > 0 ? <Breadcrumbs items={crumbs} /> : null}
        {folio || eyebrow ? (
          <div className={styles.kicker}>
            {folio ? <span className={styles.folio}>{folio}</span> : null}
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          </div>
        ) : null}
        <span className={styles.waterline} aria-hidden="true" />
        <h1 className={styles.title}>{title}</h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children}
      </Container>
    </header>
  );
}
