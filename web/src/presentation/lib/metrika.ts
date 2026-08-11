"use client";

/**
 * Цели Яндекс.Метрики. reachGoal — no-op, пока счётчик не инициализирован
 * (согласие на cookies не дано, id не настроен или tag.js ещё не загружен):
 * компонент YandexMetrika регистрирует id после реального запуска счётчика.
 */

export type MetrikaFn = ((...args: unknown[]) => void) & {
  a?: unknown[][];
  l?: number;
};

declare global {
  interface Window {
    ym?: MetrikaFn;
  }
}

export const METRIKA_GOALS = {
  /** Успешно отправленная заявка (любая форма LeadForm). */
  LEAD_SUBMIT: "lead_submit",
} as const;

export type MetrikaGoal = (typeof METRIKA_GOALS)[keyof typeof METRIKA_GOALS];

let counterId: number | null = null;

/** Вызывается YandexMetrika после init — до этого reachGoal молчит. */
export function registerMetrikaCounter(id: number): void {
  counterId = id;
}

export function reachGoal(goal: MetrikaGoal, params?: Record<string, unknown>): void {
  if (counterId === null) return;
  if (typeof window === "undefined" || typeof window.ym !== "function") return;
  window.ym(counterId, "reachGoal", goal, params);
}
