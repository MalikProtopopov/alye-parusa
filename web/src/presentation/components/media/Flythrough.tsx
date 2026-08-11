"use client";

import { useEffect, useRef } from "react";
import type { Flythrough as FlythroughModel } from "@/domain";
import { cn } from "@/presentation/lib/cn";
import styles from "./Flythrough.module.css";

/** Muted, looping drone clip that plays only while on screen. */
export function Flythrough({
  flythrough,
  className,
}: {
  flythrough: FlythroughModel;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <figure className={cn(styles.wrap, className)}>
      <video
        ref={ref}
        className={styles.video}
        src={flythrough.video}
        poster={flythrough.poster}
        muted
        loop
        playsInline
        preload="none"
      />
      <figcaption className={styles.caption}>
        <span className={styles.title}>{flythrough.title}</span>
        <span className={styles.text}>{flythrough.caption}</span>
      </figcaption>
    </figure>
  );
}
