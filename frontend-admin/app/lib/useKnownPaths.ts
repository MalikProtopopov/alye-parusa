"use client";

// Известные пути сайта (GET /admin/seo-known-paths) — питают pagePicker
// и панель «Страницы без SEO». Кэш на модуль живёт 60 с: без срока годности
// панель продолжала бы предлагать страницы, для которых SEO-запись уже
// создана (и уводила бы в 409). Недоступный бэкенд → null (интерфейс
// работает без списка).

import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export interface KnownPath {
  path: string;
  label: string;
  kind: "static" | "plan_category" | "floorplan" | "news" | "document";
  has_seo: boolean;
}

const TTL_MS = 60_000;

let cache: KnownPath[] | null = null;
let cachedAt = 0;
let inflight: Promise<KnownPath[] | null> | null = null;

function cacheFresh(): boolean {
  return cache !== null && Date.now() - cachedAt < TTL_MS;
}

async function fetchKnownPaths(): Promise<KnownPath[] | null> {
  try {
    const data = await apiFetch<KnownPath[]>("/api/v1/admin/seo-known-paths");
    cache = Array.isArray(data) ? data : null;
    cachedAt = Date.now();
    return cache;
  } catch {
    return null;
  } finally {
    inflight = null;
  }
}

/** Сбросить кэш — после создания/удаления SEO-записи список устарел. */
export function invalidateKnownPaths(): void {
  cache = null;
  cachedAt = 0;
}

/** null — список ещё не загружен или бэкенд недоступен. */
export function useKnownPaths(): KnownPath[] | null {
  const [paths, setPaths] = useState<KnownPath[] | null>(
    cacheFresh() ? cache : null
  );

  useEffect(() => {
    if (cacheFresh()) {
      setPaths(cache);
      return;
    }
    let cancelled = false;
    if (!inflight) inflight = fetchKnownPaths();
    void inflight.then((data) => {
      if (!cancelled && data) setPaths(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return paths;
}
