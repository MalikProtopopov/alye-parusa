"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorScreen } from "@/presentation/components/layout/ErrorScreen";
import buttonStyles from "@/presentation/components/primitives/Button.module.css";
import { cn } from "@/presentation/lib/cn";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced for ops — the visitor sees the styled screen below.
    console.error(error);
  }, [error]);

  return (
    <main>
      <ErrorScreen
        code="Ошибка"
        title="Что-то пошло не так"
        text="Мы уже разбираемся. Попробуйте обновить страницу или вернитесь на главную."
        actions={
          <>
            <button
              type="button"
              onClick={reset}
              className={cn(buttonStyles.button, buttonStyles.primary)}
            >
              Попробовать снова
            </button>
            <Link href="/" className={cn(buttonStyles.button, buttonStyles.ghost)}>
              На главную
            </Link>
          </>
        }
      />
    </main>
  );
}
