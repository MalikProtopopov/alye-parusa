import type { InfrastructureView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import { Flythrough } from "../media/Flythrough";
import styles from "./InfrastructureSection.module.css";

export function InfrastructureSection({
  data,
  text,
  index = "03",
}: {
  data: InfrastructureView;
  text: SectionText;
  index?: string;
}) {
  const { amenities, flythroughs } = data;

  return (
    <Section id="infrastructure" tone="base">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead}
        />

        {flythroughs.length > 0 ? (
          <div className={styles.clips}>
            {flythroughs.map((flythrough) => (
              <Reveal key={flythrough.id}>
                <Flythrough flythrough={flythrough} />
              </Reveal>
            ))}
          </div>
        ) : null}

        <div className={styles.grid}>
          {amenities.map((amenity, index) => (
            <Reveal key={amenity.id} delay={index * 50}>
              <article className={styles.card}>
                <h3 className={styles.cardTitle}>{amenity.title}</h3>
                <p className={styles.cardText}>{amenity.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
