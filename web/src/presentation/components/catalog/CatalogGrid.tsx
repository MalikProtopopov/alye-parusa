import type { Floorplan } from "@/domain";
import { Reveal } from "../primitives/Reveal";
import { FloorplanCard } from "./FloorplanCard";
import styles from "./CatalogGrid.module.css";

export function CatalogGrid({ floorplans }: { floorplans: Floorplan[] }) {
  if (floorplans.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Каталог пополняется</p>
        <p className={styles.emptyText}>
          Оставьте заявку — менеджер подберёт планировку под ваш запрос и пришлёт
          актуальные варианты.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {floorplans.map((floorplan, index) => (
        <Reveal key={floorplan.id} delay={(index % 3) * 60}>
          <FloorplanCard floorplan={floorplan} />
        </Reveal>
      ))}
    </div>
  );
}
