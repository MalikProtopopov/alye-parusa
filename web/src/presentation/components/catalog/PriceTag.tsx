import { cn } from "@/presentation/lib/cn";
import { formatPriceRub } from "@/presentation/lib/format";
import styles from "./PriceTag.module.css";

/** Formatted ₽ price, or the «узнать цену» invitation when prices are hidden. */
export function PriceTag({
  price,
  size = "md",
  className,
}: {
  price: number | null;
  size?: "md" | "lg";
  className?: string;
}) {
  if (price === null) {
    return (
      <span className={cn(styles.onRequest, size === "lg" && styles.lgOnRequest, className)}>
        Узнать цену
      </span>
    );
  }
  return (
    <span className={cn(styles.price, size === "lg" && styles.lg, className)}>
      {formatPriceRub(price)}
    </span>
  );
}
