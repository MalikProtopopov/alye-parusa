"use client";

import { useCallback, useRef, useState } from "react";

export interface ToastMsg {
  text: string;
  kind: "success" | "error";
}

// Тост с автоскрытием: успех — 3,2 с; ошибка — 8 с (длинные сообщения
// об ошибке — единственное место, где о них сообщается). Крестик в Toast
// позволяет закрыть раньше.
const SUCCESS_MS = 3200;
const ERROR_MS = 8000;

export function useToast() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMsg(null);
  }, []);

  const show = useCallback(
    (text: string, kind: "success" | "error" = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setMsg({ text, kind });
      timer.current = setTimeout(
        () => setMsg(null),
        kind === "error" ? ERROR_MS : SUCCESS_MS
      );
    },
    []
  );

  return { msg, show, dismiss };
}
