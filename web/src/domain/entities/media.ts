/**
 * The scroll-scrub source: an image sequence (primary, iOS-safe) plus a poster
 * and a reduced-motion fallback video. Frame count/dimensions are read at
 * runtime from `manifestUrl` so the pipeline (scripts/prepare-media.sh) stays
 * the single source of truth.
 */
export interface FrameSequenceMedia {
  /** Stable id for the hero variant selector. */
  id: string;
  /** Human label shown in the hero toggle. */
  label: string;
  manifestUrl: string;
  poster: string;
  fallbackVideo: string;
  /** width / height, e.g. 16/9. */
  aspectRatio: number;
}

/** A cinematic drone fly-through used as an intro to a content section. */
export interface Flythrough {
  id: string;
  title: string;
  caption: string;
  video: string;
  poster: string;
}

/** A still architectural render used in content sections. */
export interface RenderImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}
