import type { NewsItem, SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { NewsGrid } from "../news/NewsGrid";
import { Button } from "../primitives/Button";
import { Container } from "../primitives/Container";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./NewsSection.module.css";

/** The three latest news items + the road into /novosti. */
export function NewsSection({
  items,
  text,
}: {
  items: NewsItem[];
  text: SectionText;
}) {
  return (
    <Section id="news" tone="base">
      <Container>
        <SectionHeading
          variant="aside"
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead}
        />
        <NewsGrid items={items.slice(0, 3)} spaced />
        <div className={styles.more}>
          <Button href="/novosti" variant="ghost">
            Все новости
          </Button>
        </div>
      </Container>
    </Section>
  );
}
