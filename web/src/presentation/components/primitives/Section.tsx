import type { ReactNode } from "react";
import { cn } from "@/presentation/lib/cn";
import styles from "./Section.module.css";

type Tone = "base" | "sand" | "elevated";

export function Section({
  id,
  tone = "base",
  className,
  children,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn(styles.section, styles[tone], className)}>
      {children}
    </section>
  );
}
