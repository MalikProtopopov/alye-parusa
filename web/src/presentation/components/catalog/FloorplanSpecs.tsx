import type { Floorplan } from "@/domain";
import { formatAreaM2 } from "@/presentation/lib/format";
import { AVAILABILITY_LABELS } from "./availability";
import styles from "./FloorplanSpecs.module.css";

/** Key characteristics of a floorplan as a semantic definition list. */
export function FloorplanSpecs({ floorplan }: { floorplan: Floorplan }) {
  const rows: Array<{ term: string; value: string }> = [
    { term: "Площадь", value: formatAreaM2(floorplan.areaM2) },
  ];
  if (floorplan.floor !== null) {
    rows.push({ term: "Этаж", value: String(floorplan.floor) });
  }
  if (floorplan.ceilingHeight !== null) {
    rows.push({ term: "Потолки", value: `${floorplan.ceilingHeight} м` });
  }
  rows.push({ term: "Статус", value: AVAILABILITY_LABELS[floorplan.availability] });

  return (
    <dl className={styles.specs}>
      {rows.map((row) => (
        <div key={row.term} className={styles.row}>
          <dt className={styles.term}>{row.term}</dt>
          <dd className={styles.value}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
