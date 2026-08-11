/** Runtime shape of /media/hero/frames/manifest.json. */
export interface FrameManifest {
  count: number;
  pattern: string;
  width: number;
  height: number;
  pad: number;
}

/** Resolve a frame URL from the manifest pattern (`frame-%03d.jpg`, 1-indexed). */
export function frameUrl(manifest: FrameManifest, index: number): string {
  const n = String(index + 1).padStart(manifest.pad, "0");
  return manifest.pattern.replace(/%0?\d*d/, n);
}

/**
 * Opacity of a hero chapter at scroll `progress`, given its [from, to] window.
 * Fades in/out near the edges; first chapter starts visible, last stays visible
 * at the very bottom so the CTA never disappears.
 */
export function chapterVisibility(progress: number, from: number, to: number): number {
  if (progress < from || progress > to) return 0;
  const fade = Math.min(0.08, (to - from) * 0.4);
  const rise = from <= 0 ? 1 : Math.min(1, (progress - from) / fade);
  const fall = to >= 1 ? 1 : Math.min(1, (to - progress) / fade);
  return Math.max(0, Math.min(rise, fall));
}
