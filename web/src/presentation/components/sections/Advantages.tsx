import type { ProjectOverviewView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { AnimatedNumber } from "../primitives/AnimatedNumber";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./Advantages.module.css";

export function Advantages({
  overview,
  text,
  index = "01",
}: {
  overview: ProjectOverviewView;
  text: SectionText;
  index?: string;
}) {
  const { project, advantages } = overview;

  return (
    <Section id="about" tone="base">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead ?? project.tagline}
        />

        <ul className={styles.facts}>
          {project.facts.map((fact) => (
            <li key={fact.id} className={styles.fact}>
              <span className={styles.value}>
                <AnimatedNumber value={fact.value} />
              </span>
              <span className={styles.label}>{fact.label}</span>
            </li>
          ))}
        </ul>

        {/* Первая удобство-карточка — ведущая (подложка, крупный набор),
            остальные идут списком на бумаге: асимметрия вместо четырёх
            одинаковых плиток. */}
        <div className={styles.grid}>
          {advantages.map((amenity, i) => (
            <Reveal key={amenity.id} delay={i * 60}>
              <article
                className={i === 0 ? `${styles.card} ${styles.lead}` : styles.card}
              >
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
