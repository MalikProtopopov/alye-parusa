"use client";

import Image from "next/image";
import type { ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/presentation/lib/cn";
import { Sail } from "../brand/Sail";
import styles from "./SafeImage.module.css";

/** What kind of media the slot expects — drives the glyph and the caption. */
export type MediaKind = "photo" | "floorplan" | "portrait" | "logo";

/** Two honest states: nothing uploaded yet vs. uploaded but did not load. */
const CAPTIONS: Record<MediaKind, { empty: string; failed: string }> = {
  photo: { empty: "Изображение скоро появится", failed: "Изображение готовится" },
  floorplan: { empty: "Чертёж скоро появится", failed: "Чертёж готовится" },
  portrait: { empty: "Фото скоро появится", failed: "Фото готовится" },
  logo: { empty: "Логотип скоро появится", failed: "Логотип готовится" },
};

type SafeImageProps = Omit<ImageProps, "src" | "alt" | "onError"> & {
  /** CMS media URL; `null`/`undefined` renders the «ещё не загружено» state. */
  src: string | null | undefined;
  alt: string;
  kind?: MediaKind;
  /** Overrides the default caption for both empty and failed states. */
  fallbackLabel?: string;
  /** Replaces the whole placeholder body (glyph + caption), e.g. initials. */
  fallbackContent?: ReactNode;
  /** Extra class for the placeholder box (the image keeps `className`). */
  fallbackClassName?: string;
};

/**
 * next/image with a designed «нет изображения» state instead of a broken tile.
 * A missing `src` renders the placeholder straight away; a network/optimizer
 * failure swaps the image for the same placeholder via `onError`, so a CMS
 * upload that disappeared never leaves a torn-page icon on the site.
 */
export function SafeImage({
  src,
  alt,
  kind = "photo",
  fallbackLabel,
  fallbackContent,
  fallbackClassName,
  className,
  fill,
  width,
  height,
  style,
  ...rest
}: SafeImageProps) {
  // Keyed by src, so a new src after a failure gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const failed = Boolean(src) && failedSrc === src;

  // An image that already failed before hydration never fires `error` at us —
  // a finished load with zero intrinsic width is the tell.
  useEffect(() => {
    const image = imageRef.current;
    if (src && image && image.complete && image.naturalWidth === 0) {
      setFailedSrc(src);
    }
  }, [src]);

  if (src && !failed) {
    return (
      <Image
        {...rest}
        ref={imageRef}
        src={src}
        alt={alt}
        className={className}
        {...(fill ? { fill: true } : { width, height })}
        style={style}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  const caption = fallbackLabel ?? CAPTIONS[kind][failed ? "failed" : "empty"];
  // Without `fill` the slot has no intrinsic box — borrow the image ratio.
  const ratio =
    !fill && width && height ? { aspectRatio: `${width} / ${height}` } : undefined;

  return (
    <span
      className={cn(styles.fallback, fill ? styles.fill : styles.flow, fallbackClassName)}
      style={{ ...ratio, ...(style as CSSProperties | undefined) }}
      role="img"
      aria-label={alt}
      data-state={failed ? "failed" : "empty"}
    >
      {fallbackContent ?? (
        <>
          <span className={styles.glyph} aria-hidden="true">
            {kind === "floorplan" ? <PlanGlyph /> : <Sail />}
          </span>
          <span className={styles.caption} aria-hidden="true">
            {caption}
          </span>
        </>
      )}
    </span>
  );
}

/** Hairline plan sheet — the drawing-board twin of the sail motif. */
function PlanGlyph() {
  return (
    <svg viewBox="0 0 120 96" className={styles.plan} xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="108" height="84" rx="2" />
      <line x1="52" y1="6" x2="52" y2="56" />
      <line x1="52" y1="56" x2="114" y2="56" />
      <line x1="6" y1="62" x2="52" y2="62" />
      <line x1="82" y1="56" x2="82" y2="90" />
    </svg>
  );
}
