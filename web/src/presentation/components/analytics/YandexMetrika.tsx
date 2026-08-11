"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, hasConsent } from "@/presentation/lib/consent";
import { registerMetrikaCounter } from "@/presentation/lib/metrika";
import type { MetrikaFn } from "@/presentation/lib/metrika";

const METRIKA_SRC = "https://mc.yandex.ru/metrika/tag.js";

function initMetrika(id: number): void {
  if (document.querySelector(`script[src="${METRIKA_SRC}"]`)) return;
  // Standard tag bootstrap: a queueing stub until tag.js arrives.
  const w = window;
  if (!w.ym) {
    const stub: MetrikaFn = (...args: unknown[]) => {
      stub.a = stub.a ?? [];
      stub.a.push(args);
    };
    w.ym = stub;
  }
  w.ym.l = Date.now();
  const script = document.createElement("script");
  script.async = true;
  script.src = METRIKA_SRC;
  document.head.appendChild(script);
  w.ym(id, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  });
  registerMetrikaCounter(id); // цели (reachGoal) активируются вместе со счётчиком
}

/**
 * Yandex.Metrika, 152-ФЗ-safe: the counter loads ONLY after the visitor
 * accepts the cookie notice. SPA route changes are reported as hits.
 */
export function YandexMetrika({ id }: { id: string | null }) {
  const counterId = id ? Number.parseInt(id, 10) : NaN;
  const startedRef = useRef(false);
  const pathname = usePathname();
  // init сам репортит первый просмотр — SPA-эффект не должен дублировать его
  // для стартового pathname (иначе визит с сохранённым согласием считается дважды)
  const lastHitPathRef = useRef(pathname);

  useEffect(() => {
    if (!Number.isFinite(counterId)) return;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      initMetrika(counterId);
    };

    if (hasConsent()) {
      start();
      return;
    }
    window.addEventListener(CONSENT_EVENT, start);
    return () => window.removeEventListener(CONSENT_EVENT, start);
  }, [counterId]);

  // SPA hits: report route CHANGES once the counter runs (init covers the first view).
  useEffect(() => {
    if (pathname === lastHitPathRef.current) return;
    lastHitPathRef.current = pathname;
    if (startedRef.current && window.ym) {
      window.ym(counterId, "hit", window.location.href);
    }
  }, [counterId, pathname]);

  // Без noscript-пикселя: посетитель без JavaScript не может дать согласие
  // в cookie-баннере, поэтому учитывать его Метрикой нельзя (152-ФЗ).
  return null;
}
