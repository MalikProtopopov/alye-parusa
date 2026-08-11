"use client";

import { useCallback, useRef } from "react";
import type { ScrollStory as StoryModel } from "@/domain";
import { useInView } from "@/presentation/hooks/use-in-view";
import { usePrefersReducedMotion } from "@/presentation/hooks/use-prefers-reduced-motion";
import { chapterVisibility } from "@/presentation/lib/scrub";
import { cn } from "@/presentation/lib/cn";
import { useScrollScrub } from "../hero/use-scroll-scrub";
import styles from "./ScrollStory.module.css";

export function ScrollStory({ story }: { story: StoryModel }) {
  const reduced = usePrefersReducedMotion();
  // Gate frame loading until the section is within ~1 screen — keeps it off the
  // initial page load (the hero already streams its own frames).
  const { ref: triggerRef, inView } = useInView<HTMLDivElement>({
    rootMargin: "120% 0px 120% 0px",
    threshold: 0,
    once: true,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beatRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const onProgress = useCallback(
    (progress: number) => {
      for (const beat of story.beats) {
        const el = beatRefs.current.get(beat.id);
        if (!el) continue;
        const v = chapterVisibility(progress, beat.from, beat.to);
        const dir = beat.side === "left" ? -1 : 1;
        el.style.opacity = String(v);
        el.style.transform = `translateX(${(1 - v) * 48 * dir}px)`;
      }
    },
    [story.beats],
  );

  useScrollScrub({
    manifestUrl: story.manifestUrl,
    triggerRef,
    canvasRef,
    onProgress,
    enabled: !reduced && inView,
  });

  if (reduced) return <StaticStory story={story} />;

  return (
    <div ref={triggerRef} className={styles.story} aria-label={story.eyebrow}>
      <div className={styles.sticky}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.poster} src={story.poster} alt="" aria-hidden="true" />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.scrim} aria-hidden="true" />
        <div className={styles.stage}>
          {story.beats.map((beat) => (
            <div
              key={beat.id}
              ref={(el) => {
                if (el) beatRefs.current.set(beat.id, el);
              }}
              className={cn(styles.beat, styles[beat.side])}
              style={{ opacity: chapterVisibility(0, beat.from, beat.to) }}
            >
              <BeatBody eyebrow={story.eyebrow} title={beat.title} text={beat.text} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BeatBody({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <>
      <p className={styles.beatEyebrow}>{eyebrow}</p>
      <h2 className={styles.beatTitle}>{title}</h2>
      <p className={styles.beatText}>{text}</p>
    </>
  );
}

/** Motion-free: poster + beats stacked, no scrub. */
function StaticStory({ story }: { story: StoryModel }) {
  return (
    <section className={styles.staticStory} aria-label={story.eyebrow}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.poster} src={story.poster} alt="" aria-hidden="true" />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={cn(styles.stage, styles.staticStage)}>
        {story.beats.map((beat) => (
          <div key={beat.id} className={cn(styles.beat, styles[beat.side], styles.staticBeat)}>
            <BeatBody eyebrow={story.eyebrow} title={beat.title} text={beat.text} />
          </div>
        ))}
      </div>
    </section>
  );
}
