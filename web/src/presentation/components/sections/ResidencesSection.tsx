import Link from "next/link";
import type { ResidencesView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { Button } from "../primitives/Button";
import { Container } from "../primitives/Container";
import { SafeImage } from "../primitives/SafeImage";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";
import { cn } from "@/presentation/lib/cn";
import styles from "./ResidencesSection.module.css";

const CATALOG_HREF = "/planirovki";

export function ResidencesSection({
  data,
  text,
  index = "04",
}: {
  data: ResidencesView;
  text: SectionText;
  index?: string;
}) {
  const { program, finishes, gallery } = data;

  return (
    <Section id="residences" tone="elevated">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={
            text.lead ??
            `${program.minAreaM2}–${program.maxAreaM2} м² · ${program.floors} этажей · ${finishes.length} варианта отделки`
          }
        />

        <div className={styles.finishes}>
          {finishes.map((finish) => (
            // Every finish leads into the catalog — the section is the road to
            // /planirovki, not a dead end.
            <Link key={finish.id} href={CATALOG_HREF} className={styles.finish}>
              <h3 className={styles.finishName}>{finish.name}</h3>
              <p className={styles.finishText}>{finish.description}</p>
              <span className={styles.finishLink}>
                Смотреть планировки<span aria-hidden="true"> →</span>
              </span>
            </Link>
          ))}
        </div>

        <div className={styles.gallery}>
          {gallery.map((image, index) => {
            // First and last plates span full width → no dangling empty cell,
            // and the gallery opens and closes on a wide shot.
            const isWide = index === 0 || index === gallery.length - 1;
            return (
              <div key={image.id} className={cn(styles.cell, isWide && styles.wide)}>
                <figure className={styles.figure}>
                  <SafeImage
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    sizes={isWide ? "100vw" : "(min-width: 1024px) 50vw, 100vw"}
                    className={styles.img}
                  />
                </figure>
              </div>
            );
          })}
        </div>

        <div className={styles.more}>
          <Button href={CATALOG_HREF}>Смотреть планировки</Button>
        </div>
      </Container>
    </Section>
  );
}
