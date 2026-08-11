import type { Floorplan, SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { CatalogGrid } from "../catalog/CatalogGrid";
import { Button } from "../primitives/Button";
import { Container } from "../primitives/Container";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import styles from "./FloorplansSection.module.css";

/** Featured floorplans on the landing + the road into the full catalog. */
export function FloorplansSection({
  floorplans,
  text,
}: {
  floorplans: Floorplan[];
  text: SectionText;
}) {
  return (
    <Section id="floorplans" tone="base">
      <Container>
        <SectionHeading
          variant="aside"
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead ?? "Избранные форматы — от студий до семейных апартаментов."}
        />
        <div className={styles.grid}>
          <CatalogGrid floorplans={floorplans} />
        </div>
        <div className={styles.more}>
          <Button href="/planirovki" variant="ghost">
            Все планировки
          </Button>
        </div>
      </Container>
    </Section>
  );
}
