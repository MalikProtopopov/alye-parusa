"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { frameUrl } from "@/presentation/lib/scrub";
import type { FrameManifest } from "@/presentation/lib/scrub";

interface Options {
  manifestUrl: string;
  triggerRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onProgress: (progress: number) => void;
  enabled: boolean;
}

interface ScrubState {
  ready: boolean;
  frameCount: number;
}

/**
 * Canvas image-sequence scrubber. Sticky-CSS handles the visual pin; this hook
 * maps scroll progress over `triggerRef` to a frame index and draws it (cover
 * fit, DPR-capped). Frames stream in progressively so first paint is instant.
 */
export function useScrollScrub({
  manifestUrl,
  triggerRef,
  canvasRef,
  onProgress,
  enabled,
}: Options): ScrubState {
  const [ready, setReady] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const trigger = triggerRef.current;
    if (!canvas || !trigger) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    gsap.registerPlugin(ScrollTrigger);

    // Clear any frame left over from a previously-selected variant.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let manifest: FrameManifest | null = null;
    let images: HTMLImageElement[] = [];
    let currentIndex = -1;
    let scrollTrigger: ScrollTrigger | null = null;
    let cancelled = false;

    const nearestLoaded = (index: number): HTMLImageElement | null => {
      for (let d = 1; d < images.length; d++) {
        const lo = images[index - d];
        if (lo && lo.complete && lo.naturalWidth > 0) return lo;
        const hi = images[index + d];
        if (hi && hi.complete && hi.naturalWidth > 0) return hi;
      }
      return null;
    };

    const draw = (index: number) => {
      const primary = images[index];
      const img =
        primary && primary.complete && primary.naturalWidth > 0
          ? primary
          : nearestLoaded(index);
      if (!img) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      draw(currentIndex < 0 ? 0 : currentIndex);
    };

    const loadFrame = (i: number) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (!cancelled && i === currentIndex) draw(i);
      };
      img.src = frameUrl(manifest as FrameManifest, i);
      images[i] = img;
    };

    const run = async () => {
      try {
        const res = await fetch(manifestUrl);
        manifest = (await res.json()) as FrameManifest;
      } catch {
        return;
      }
      if (cancelled || !manifest) return;

      const count = manifest.count;
      setFrameCount(count);
      images = new Array(count);

      // First frame first, so the canvas paints immediately.
      currentIndex = 0;
      loadFrame(0);
      resize();
      setReady(true);

      // Eager first batch, then time-sliced streaming for the rest.
      const eager = Math.min(count, 24);
      for (let i = 1; i < eager; i++) loadFrame(i);
      let next = eager;
      const pump = () => {
        if (cancelled) return;
        const deadline = performance.now() + 8;
        while (next < count && performance.now() < deadline) {
          loadFrame(next);
          next += 1;
        }
        if (next < count) requestAnimationFrame(pump);
      };
      requestAnimationFrame(pump);

      scrollTrigger = ScrollTrigger.create({
        trigger,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          const idx = Math.min(count - 1, Math.max(0, Math.round(p * (count - 1))));
          if (idx !== currentIndex) {
            currentIndex = idx;
            draw(idx);
          }
          onProgress(p);
        },
      });

      // Seed from the trigger's REAL scroll position — 0 at top of page, but the
      // actual progress when a variant is toggled mid-scroll (never snap to 0).
      const startProgress = scrollTrigger.progress;
      const startIndex = Math.min(count - 1, Math.max(0, Math.round(startProgress * (count - 1))));
      currentIndex = startIndex;
      loadFrame(startIndex);
      draw(startIndex);
      onProgress(startProgress);
    };

    window.addEventListener("resize", resize);
    void run();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      scrollTrigger?.kill();
    };
    // onProgress is intentionally excluded — it is a stable useCallback in Hero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, manifestUrl, canvasRef, triggerRef]);

  return { ready, frameCount };
}
