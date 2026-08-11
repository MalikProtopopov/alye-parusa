"use client";

import { useCallback, useRef } from "react";
import type { HeroChapterView, HeroExperienceView, HeroMediaView } from "@/application";
import { usePrefersReducedMotion } from "@/presentation/hooks/use-prefers-reduced-motion";
import { chapterVisibility } from "@/presentation/lib/scrub";
import { cn } from "@/presentation/lib/cn";
import { Sail } from "../brand/Sail";
import { Button } from "../primitives/Button";
import { useScrollScrub } from "./use-scroll-scrub";
import styles from "./Hero.module.css";

export function Hero({ experience }: { experience: HeroExperienceView }) {
  const { chapters, variants } = experience;
  // Одна сцена: выбор режима видео посетителю не нужен (переключатель убран)
  const media = variants[0];
  const reduced = usePrefersReducedMotion();

  const triggerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const onProgress = useCallback(
    (progress: number) => {
      for (const chapter of chapters) {
        const el = chapterRefs.current.get(chapter.id);
        if (!el) continue;
        const v = chapterVisibility(progress, chapter.from, chapter.to);
        el.style.opacity = String(v);
        el.style.transform = `translateY(${(1 - v) * 14}px)`;
        el.style.visibility = v > 0 ? "visible" : "hidden";
        el.style.pointerEvents = v > 0.6 ? "auto" : "none";
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = progress > 0.02 ? "0" : "1";
      }
    },
    [chapters],
  );

  useScrollScrub({
    manifestUrl: media.manifestUrl,
    triggerRef,
    canvasRef,
    onProgress,
    enabled: !reduced,
  });

  if (reduced) {
    return <StaticHero media={media} chapters={chapters} />;
  }

  return (
    <div ref={triggerRef} className={styles.hero} aria-label="Строительство квартала «Алые Паруса»">
      <div className={styles.sticky}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.poster} src={media.poster} alt="" aria-hidden="true" />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.scrim} aria-hidden="true" />

        <div className={styles.stage}>
          {chapters.map((chapter) => {
            const initial = chapterVisibility(0, chapter.from, chapter.to);
            return (
              <div
                key={chapter.id}
                ref={(el) => {
                  if (el) chapterRefs.current.set(chapter.id, el);
                }}
                className={cn(styles.chapter, chapter.segment === "intro" && styles.intro)}
                style={{
                  opacity: initial,
                  visibility: initial > 0 ? "visible" : "hidden",
                }}
              >
                <ChapterBody chapter={chapter} intro={chapter.segment === "intro"} />
              </div>
            );
          })}
        </div>

        <div ref={hintRef} className={styles.hint} aria-hidden="true">
          <span>Листайте</span>
          <span className={styles.hintLine} />
        </div>
      </div>
    </div>
  );
}

function ChapterBody({ chapter, intro }: { chapter: HeroChapterView; intro: boolean }) {
  return (
    <>
      {chapter.cta ? <Sail className={styles.heroSail} /> : null}
      {chapter.eyebrow ? <p className={styles.eyebrow}>{chapter.eyebrow}</p> : null}
      {intro ? (
        <h1 className={styles.headline}>{chapter.headline}</h1>
      ) : (
        <p className={styles.headline}>{chapter.headline}</p>
      )}
      <p className={styles.sub}>{chapter.subheadline}</p>
      {chapter.cta ? (
        <div className={styles.cta}>
          <Button href={chapter.cta.href}>{chapter.cta.label}</Button>
        </div>
      ) : null}
    </>
  );
}

/** Motion-free hero: poster still + the intro copy and CTA. */
function StaticHero({ media, chapters }: { media: HeroMediaView; chapters: HeroChapterView[] }) {
  const intro = chapters[0];
  const cta = chapters.find((c) => c.cta)?.cta;

  return (
    <header className={styles.staticHero}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.poster} src={media.poster} alt="Панорама квартала «Алые Паруса» у моря" />
      <div className={styles.scrim} aria-hidden="true" />
      <div className={cn(styles.stage, styles.staticStage)}>
        <div
          className={cn(styles.chapter, styles.intro)}
          style={{ opacity: 1, visibility: "visible", pointerEvents: "auto" }}
        >
          {intro ? (
            <>
              <h1 className={styles.headline}>{intro.headline}</h1>
              <p className={styles.sub}>{intro.subheadline}</p>
            </>
          ) : null}
          {cta ? (
            <div className={styles.cta}>
              <Button href={cta.href}>{cta.label}</Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
