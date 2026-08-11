import Link from "next/link";
import type { Floorplan } from "@/domain";
import { formatAreaM2 } from "@/presentation/lib/format";
import { SafeImage } from "../primitives/SafeImage";
import { PriceTag } from "./PriceTag";
import { AVAILABILITY_LABELS } from "./availability";
import styles from "./FloorplanCard.module.css";

export function FloorplanCard({ floorplan }: { floorplan: Floorplan }) {
  const meta = [
    formatAreaM2(floorplan.areaM2),
    floorplan.floor !== null ? `${floorplan.floor} этаж` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/planirovki/${floorplan.slug}`} className={styles.card}>
      <div className={styles.media}>
        <SafeImage
          src={floorplan.imageUrl}
          alt={`Планировка «${floorplan.title}», ${formatAreaM2(floorplan.areaM2)}`}
          kind="floorplan"
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className={styles.img}
        />
        {floorplan.category ? (
          <span className={styles.badge}>{floorplan.category.title}</span>
        ) : null}
        {floorplan.availability !== "available" ? (
          <span className={styles.status}>
            {AVAILABILITY_LABELS[floorplan.availability]}
          </span>
        ) : null}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{floorplan.title}</h3>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
        <PriceTag price={floorplan.price} className={styles.price} />
      </div>
    </Link>
  );
}
