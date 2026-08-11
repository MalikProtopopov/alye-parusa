"use client";

// Счётчик новых заявок для бейджа в сайдбаре.
// Поллинг раз в 60 с; вкладка в фоне (document.hidden) — тик пропускается,
// при возврате на вкладку — немедленное обновление. Ошибки сети/API → null
// (бейдж просто не показывается), поллинг продолжается.
// 401 — фоновый запрос НИКОГДА не редиректит и не чистит токен: бейдж
// скрывается, поллинг останавливается до следующего монтирования.
// Событие LEADS_CHANGED_EVENT (смена статуса/удаление заявки) — немедленный тик.

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "./api";

const POLL_MS = 60_000;

/** Имя window-события «заявки изменились» — бейдж обновляется сразу. */
export const LEADS_CHANGED_EVENT = "leads-changed";

/** Дёрнуть немедленное обновление бейджа (после смены статуса/удаления). */
export function notifyLeadsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
  }
}

export function useNewLeadsCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stopped = false; // 401: сессия истекла — молчим до следующего монтирования

    async function tick() {
      if (document.hidden || stopped) return;
      try {
        const data = await apiFetch<{ count: number }>(
          "/api/v1/admin/leads/count?status=new",
          { on401: "silent" }
        );
        if (!cancelled) {
          setCount(typeof data?.count === "number" ? data.count : null);
        }
      } catch (err) {
        if (cancelled) return;
        setCount(null);
        if (err instanceof ApiError && err.status === 401) {
          // Не дёргаем пользователя из фона: просто прекращаем поллинг.
          stopped = true;
          clearInterval(timer);
        }
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    const onLeadsChanged = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(LEADS_CHANGED_EVENT, onLeadsChanged);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(LEADS_CHANGED_EVENT, onLeadsChanged);
    };
  }, []);

  return count;
}
