import Link from "next/link";
import type { Floorplan, InstallmentQuote } from "@/domain";
import { formatAreaM2, formatPriceRub } from "@/presentation/lib/format";
import { RichText } from "../primitives/RichText";
import { Reveal } from "../primitives/Reveal";
import { SafeImage } from "../primitives/SafeImage";
import { FloorplanSpecs } from "./FloorplanSpecs";
import { PriceTag } from "./PriceTag";
import styles from "./FloorplanDetail.module.css";

/** Floorplan page body: plate image, price + installment teaser, specs, rich description. */
export function FloorplanDetail({
  floorplan,
  teaser,
}: {
  floorplan: Floorplan;
  /** Server-computed «от N ₽/мес» quote (min down payment, max term). */
  teaser: InstallmentQuote | null;
}) {
  return (
    <div className={styles.detail}>
      <div className={styles.layout}>
        <Reveal variant="mask" className={styles.mediaReveal}>
          <div className={styles.media}>
            <SafeImage
              src={floorplan.imageUrl}
              alt={`Планировка «${floorplan.title}», ${formatAreaM2(floorplan.areaM2)}`}
              kind="floorplan"
              fill
              sizes="(min-width: 900px) 55vw, 100vw"
              className={styles.img}
              priority
            />
          </div>
        </Reveal>

        <div className={styles.aside}>
          <div className={styles.priceRow}>
            <span className={styles.priceLabel}>Стоимость</span>
            <PriceTag price={floorplan.price} size="lg" />
          </div>

          {teaser ? (
            <p className={styles.teaser}>
              В рассрочку — от{" "}
              <strong className={styles.teaserValue}>
                {formatPriceRub(teaser.monthlyPayment)}/мес
              </strong>
              <Link href="/#calculator" className={styles.teaserLink}>
                Рассчитать условия →
              </Link>
            </p>
          ) : null}

          <FloorplanSpecs floorplan={floorplan} />
        </div>
      </div>

      {floorplan.descriptionHtml ? (
        <div className={styles.description}>
          <RichText html={floorplan.descriptionHtml} />
        </div>
      ) : null}
    </div>
  );
}
