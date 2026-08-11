"use client";

// Авто-слаг из названия (транслит как на бэкенде), пока пользователь
// не правил слаг вручную. markManual() — стоп авто-генерации;
// regenerate() — принудительно пересобрать из источника (кнопка «↻ Из названия»).

import { useEffect, useRef } from "react";
import { slugify } from "./slug";

export function useAutoSlug(opts: {
  enabled: boolean;
  source: string;
  onSlug: (slug: string) => void;
}): { markManual: () => void; regenerate: () => void } {
  const manualRef = useRef(false);
  const sourceRef = useRef(opts.source);
  const onSlugRef = useRef(opts.onSlug);
  sourceRef.current = opts.source;
  onSlugRef.current = opts.onSlug;

  const { enabled, source } = opts;

  useEffect(() => {
    if (!enabled || manualRef.current) return;
    onSlugRef.current(slugify(source));
  }, [enabled, source]);

  return {
    markManual: () => {
      manualRef.current = true;
    },
    regenerate: () => {
      manualRef.current = false;
      onSlugRef.current(slugify(sourceRef.current));
    },
  };
}
