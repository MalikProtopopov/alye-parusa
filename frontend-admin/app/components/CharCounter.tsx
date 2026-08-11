"use client";

// Счётчик символов у поля: «N / max», при превышении — предупреждающий цвет.
// Лимит мягкий (SEO-рекомендация), ввод не блокируется.
// Считаем графемы (countGraphemes), а не UTF-16-единицы: эмодзи и флаги —
// 1 символ, как их видит редактор. Та же функция — в предпросмотре сниппета.

import { countGraphemes } from "../lib/labels";

export default function CharCounter({
  value,
  max,
}: {
  value: string;
  max?: number;
}) {
  const len = countGraphemes(value);
  const over = max !== undefined && len > max;
  return (
    <span
      className={"char-counter" + (over ? " over" : "")}
      aria-live="polite"
    >
      {len}
      {max !== undefined ? ` / ${max}` : ""}
    </span>
  );
}
