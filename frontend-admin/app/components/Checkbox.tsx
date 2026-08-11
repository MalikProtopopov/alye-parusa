"use client";

// Единый чекбокс админки: настоящий input[type=checkbox] (клавиатура,
// формы, скринридеры работают штатно) визуально скрыт, а рисуется
// стилизованный бокс .checkbox-box с галочкой. Разметка подписи и подсказки
// совпадает с прежней (field-label + field-hint), клик по подписи
// переключает чекбокс — за это отвечает <label>-обёртка.

import type { ReactNode } from "react";
import { CheckIcon } from "./icons";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Подпись справа от бокса (жирная строка). */
  label: ReactNode;
  /** Пояснение под подписью. */
  hint?: ReactNode;
  /** id самого input — для scrollIntoView/focus по ключу поля. */
  id?: string;
  disabled?: boolean;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  hint,
  id,
  disabled,
}: CheckboxProps) {
  return (
    <label className={"checkbox" + (disabled ? " is-disabled" : "")}>
      <input
        id={id}
        type="checkbox"
        className="checkbox-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="checkbox-box" aria-hidden="true">
        <CheckIcon className="checkbox-tick" />
      </span>
      <span className="checkbox-text">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
    </label>
  );
}
