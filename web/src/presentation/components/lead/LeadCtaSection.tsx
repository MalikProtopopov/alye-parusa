import type { LeadKindDto } from "@/infrastructure/api/dto";
import { Container } from "../primitives/Container";
import { Section } from "../primitives/Section";
import { LeadCoupon } from "./LeadCoupon";
import styles from "./LeadCtaSection.module.css";

/**
 * Compact lead-capture band for internal pages (catalog, floorplan detail).
 * Та же композиция, что в финале главной: обращение слева, купон справа.
 */
export function LeadCtaSection({
  title,
  lead,
  kind = "simple_callback",
  sourceBlock,
  floorplanId,
  policyHref,
  submitLabel,
  kicker,
}: {
  title: string;
  lead?: string;
  kind?: LeadKindDto;
  sourceBlock: string;
  floorplanId?: string;
  policyHref?: string;
  submitLabel?: string;
  kicker?: string;
}) {
  return (
    <Section tone="elevated" className={styles.section}>
      <Container>
        <div className={styles.inner}>
          <div className={styles.pitch}>
            <span className={styles.waterline} aria-hidden="true" />
            <h2 className={styles.title}>{title}</h2>
            {lead ? <p className={styles.lead}>{lead}</p> : null}
          </div>

          <LeadCoupon
            kind={kind}
            sourceBlock={sourceBlock}
            floorplanId={floorplanId}
            policyHref={policyHref}
            submitLabel={submitLabel}
            kicker={kicker}
          />
        </div>
      </Container>
    </Section>
  );
}
