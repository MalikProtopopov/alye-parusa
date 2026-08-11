"use client";

import type { ReactNode } from "react";
import { useInView, useMotionReady } from "@/presentation/hooks/use-in-view";
import { cn } from "@/presentation/lib/cn";
import styles from "./Reveal.module.css";

/** Reveals children on scroll. `rise` = fade + lift, `mask` = clip-path wipe
 *  (for images). Stays visible if JS is off or reduced-motion is set. */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "rise",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "rise" | "mask";
}) {
  const ready = useMotionReady();
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.15 });

  return (
    <div
      ref={ref}
      className={cn(
        styles.reveal,
        styles[variant],
        ready && styles.armed,
        inView && styles.in,
        className,
      )}
      style={ready && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
