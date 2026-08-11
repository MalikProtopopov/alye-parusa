"use client";

import { useEffect, useRef } from "react";
import { useInView } from "@/presentation/hooks/use-in-view";

/** Single leading integer with non-numeric prefix/suffix, e.g. "750 м", "от 3 лет". */
const SINGLE_INT = /^(\D*)(\d+)(\D*)$/;

/**
 * Counts a number up when it scrolls into view (once). Renders the final value
 * on the server and for reduced-motion / ranges (e.g. "22–79") — those stay put.
 */
export function AnimatedNumber({ value }: { value: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.5, once: true });
  const startedRef = useRef(false);
  const match = value.match(SINGLE_INT);

  useEffect(() => {
    const el = ref.current;
    if (!el || !match) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const [, prefix, digits, suffix] = match;
    if (!inView) {
      if (!startedRef.current) el.textContent = `${prefix}0${suffix}`;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const target = parseInt(digits, 10);
    const duration = 1100;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      el.textContent = `${prefix}${Math.round(ease(p) * target)}${suffix}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, match, ref]);

  return <span ref={ref}>{value}</span>;
}
