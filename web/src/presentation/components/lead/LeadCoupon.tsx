import { cn } from "@/presentation/lib/cn";
import { Sail } from "../brand/Sail";
import { LeadForm, type LeadFormProps } from "./LeadForm";
import styles from "./LeadCoupon.module.css";

/**
 * Купон: бланк заявки на тёплой подложке со срезанным углом и перфорацией под
 * шапкой. Единственная форма, вокруг которой мы не рисуем «карточку с рамкой» —
 * лист отрывается от секции, а не лежит в контейнере.
 */
export function LeadCoupon({
  kicker = "Бланк заявки",
  className,
  ...form
}: LeadFormProps & { kicker?: string }) {
  return (
    <div className={cn(styles.coupon, className)}>
      <div className={styles.head}>
        <span className={styles.kicker}>{kicker}</span>
        <Sail className={styles.sail} />
      </div>
      <LeadForm {...form} className={styles.form} />
    </div>
  );
}
