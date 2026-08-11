import type { InvestmentCaseView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { AnimatedNumber } from "../primitives/AnimatedNumber";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./InvestmentSection.module.css";

export function InvestmentSection({
  data,
  text,
  index = "05",
}: {
  data: InvestmentCaseView;
  text: SectionText;
  index?: string;
}) {
  const { metrics, narrative } = data;

  return (
    <Section id="invest" tone="sand">
      <Container>
        <div className={styles.layout}>
          <div className={styles.head}>
            <SectionHeading
              index={index}
              eyebrow={text.eyebrow}
              title={multiline(text.title)}
              lead={text.lead}
            />
            <div className={styles.narrative}>
              {narrative.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className={styles.metrics}>
            {metrics.map((metric) => (
              <Reveal key={metric.id}>
                <div className={styles.metric}>
                  <span className={styles.value}>
                    <AnimatedNumber value={metric.value} />
                  </span>
                  <span className={styles.label}>{metric.label}</span>
                  {metric.note ? <span className={styles.note}>{metric.note}</span> : null}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
