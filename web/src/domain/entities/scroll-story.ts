/** A caption that slides in from one side during the scrolly-story. */
export interface StoryBeat {
  id: string;
  side: "left" | "right";
  title: string;
  text: string;
  /** Scroll window within the story section, both in [0, 1]. */
  from: number;
  to: number;
}

/** A pinned, scroll-scrubbed cinematic interlude: a fly-through the visitor
 *  drives forward/back with scroll while beats slide in from the sides. */
export interface ScrollStory {
  manifestUrl: string;
  poster: string;
  eyebrow: string;
  beats: StoryBeat[];
}
