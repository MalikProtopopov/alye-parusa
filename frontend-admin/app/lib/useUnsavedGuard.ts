"use client";

// Guard несохранённых изменений:
//  - beforeunload (закрытие вкладки, F5, внешние ссылки);
//  - capture-перехват кликов по внутренним ссылкам (Link/а[href^="/"])
//    → confirm → router.push.
// Программные router.push/replace (например «Сохранить и выйти»)
// guard не трогает — вызывающий код сам сбрасывает dirty перед переходом.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export const UNSAVED_MESSAGE =
  "На странице есть несохранённые изменения. Уйти без сохранения?";

export function useUnsavedGuard(dirty: boolean): void {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function onClickCapture(e: MouseEvent) {
      if (!dirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      // Ссылки внутри contentEditable (WYSIWYG): клик ставит каретку,
      // а не навигирует — guard не должен срабатывать и уводить со страницы
      if (link.isContentEditable) return;
      const href = link.getAttribute("href") ?? "";
      // Только внутренняя навигация; внешние ссылки/новые вкладки не трогаем.
      if (!href.startsWith("/")) return;
      if (link.target === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm(UNSAVED_MESSAGE)) {
        dirtyRef.current = false;
        router.push(href);
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [router]);
}
