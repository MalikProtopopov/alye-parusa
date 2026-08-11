import type { Partner, SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { SafeImage } from "../primitives/SafeImage";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./PartnersSection.module.css";

export function PartnersSection({
  partners,
  text,
}: {
  partners: Partner[];
  text: SectionText;
}) {
  return (
    <Section id="partners" tone="sand">
      <Container>
        <SectionHeading
          variant="aside"
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead}
        />
        <div className={styles.grid}>
          {partners.map((partner, i) => {
            const body = (
              <>
                {partner.logoUrl ? (
                  <span className={styles.logoWrap}>
                    <SafeImage
                      src={partner.logoUrl}
                      alt={`Логотип: ${partner.name}`}
                      kind="logo"
                      fill
                      sizes="200px"
                      className={styles.logo}
                      fallbackContent={<span className={styles.wordmark}>{partner.name}</span>}
                      fallbackClassName={styles.logoFallback}
                    />
                  </span>
                ) : (
                  <span className={styles.wordmark}>{partner.name}</span>
                )}
                {partner.description ? (
                  <span className={styles.description}>{partner.description}</span>
                ) : null}
              </>
            );
            return (
              <Reveal key={partner.id} delay={(i % 3) * 60}>
                <div className={styles.cell}>
                  {partner.url ? (
                    <a
                      className={styles.partner}
                      href={partner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {body}
                    </a>
                  ) : (
                    <span className={styles.partner}>{body}</span>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
