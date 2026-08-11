import { cn } from "@/presentation/lib/cn";
import styles from "./Sail.module.css";

/** The scarlet sail motif — Grin's «Алые Паруса». Two sails on a hairline mast,
 *  drawn to match the monograph's linework. Decorative. */
export function Sail({ className }: { className?: string }) {
  return (
    <svg
      className={cn(styles.sail, className)}
      viewBox="0 0 120 138"
      role="img"
      aria-label="Алый парус"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line className={styles.mast} x1="60" y1="4" x2="60" y2="126" />
      <path className={styles.cloth} d="M60 10 C 29 40, 23 92, 33 118 L60 118 Z" />
      <path className={styles.clothFore} d="M60 22 C 87 46, 91 95, 82 118 L60 118 Z" />
      <line className={styles.deck} x1="26" y1="118" x2="95" y2="118" />
    </svg>
  );
}
