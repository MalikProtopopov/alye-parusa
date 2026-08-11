"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires `inView` when the element scrolls into view. `once` keeps it latched.
 * SSR-safe (starts false). The observer itself is motion-agnostic — callers
 * decide what to animate and gate on prefers-reduced-motion.
 */
export function useInView<T extends Element>(options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}): { ref: React.RefObject<T | null>; inView: boolean } {
  const { threshold = 0.2, rootMargin = "0px 0px -10% 0px", once = true } = options ?? {};
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, inView };
}

/** True once mounted on the client with motion allowed — used to arm reveal
 *  animations so content stays visible when JS is off / reduced-motion is set. */
export function useMotionReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReady(true);
    }
  }, []);
  return ready;
}
