"use client";

import { useState } from "react";
import type { ToastMsg } from "../lib/useToast";
import { CloseIcon } from "./icons";

// Постоянный live-region: контейнер существует всегда, поэтому скринридеры
// озвучивают появляющиеся тосты (aria-live на динамически созданном узле
// срабатывает не во всех связках браузер+ридер).
// Крестик «закрыть раньше таймера» есть ВСЕГДА (ошибки висят 8 с): если
// родитель не передал onClose, тост прячет себя сам — иначе на страницах
// без dismiss длинную ошибку нельзя было бы убрать.
export default function Toast({
  msg,
  onClose,
}: {
  msg: ToastMsg | null;
  onClose?: () => void;
}) {
  const [dismissed, setDismissed] = useState<ToastMsg | null>(null);
  // Новое сообщение — другой объект, поэтому показывается снова.
  const visible = msg && msg !== dismissed ? msg : null;

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {visible && (
        <div className={"toast toast-" + visible.kind}>
          <span className="toast-text">{visible.text}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Закрыть уведомление"
            onClick={() => {
              setDismissed(visible);
              onClose?.();
            }}
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  );
}
