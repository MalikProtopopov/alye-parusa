import type { LocationStoryView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import { Flythrough } from "../media/Flythrough";
import styles from "./LocationSection.module.css";

export function LocationSection({
  story,
  text,
  index = "02",
}: {
  story: LocationStoryView;
  text: SectionText;
  index?: string;
}) {
  const { location, points, flythrough } = story;

  return (
    <Section id="location" tone="sand">
      <Container>
        <div className={styles.split}>
          <div className={styles.copy}>
            <SectionHeading
              index={index}
              eyebrow={text.eyebrow}
              title={multiline(text.title)}
              lead={text.lead ?? `${location.region}, ${location.district}`}
            />
            <ul className={styles.points}>
              {points.map((point) => (
                <li key={point} className={styles.point}>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Reveal className={styles.media}>
            <Flythrough flythrough={flythrough} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
