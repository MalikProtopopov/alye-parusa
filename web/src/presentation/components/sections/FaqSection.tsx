import type { FaqItem, SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Container } from "../primitives/Container";
import { RichText } from "../primitives/RichText";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./FaqSection.module.css";

/** Zero-JS accordion: native <details>/<summary>, styled to the hairline grid. */
export function FaqSection({
  items,
  text,
}: {
  items: FaqItem[];
  text: SectionText;
}) {
  return (
    <Section id="faq" tone="base">
      <Container>
        <SectionHeading
          variant="aside"
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead}
        />
        <div className={styles.list}>
          {items.map((item) => (
            <details key={item.id} className={styles.item}>
              <summary className={styles.question}>
                <span>{item.question}</span>
                <span className={styles.marker} aria-hidden="true" />
              </summary>
              <RichText html={item.answerHtml} className={styles.answer} />
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
