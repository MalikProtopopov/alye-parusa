import type { FactChip } from "@/domain";
import { cn } from "@/presentation/lib/cn";
import { AnimatedNumber } from "../primitives/AnimatedNumber";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import styles from "./FactBand.module.css";

/** A slim hairline strip of labelled facts — reused for trust and proximity. */
export function FactBand({
  chips,
  label,
  tone = "line",
}: {
  chips: FactChip[];
  label?: string;
  tone?: "line" | "sand";
}) {
  return (
    <section className={cn(styles.band, styles[tone])}>
      <Container>
        {label ? <p className={styles.caption}>{label}</p> : null}
        <Reveal>
          <ul className={styles.list}>
            {chips.map((chip) => (
              <li key={chip.id} className={styles.chip}>
                <span className={styles.value}>
                  <AnimatedNumber value={chip.value} />
                </span>
                <span className={styles.chipLabel}>{chip.label}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
