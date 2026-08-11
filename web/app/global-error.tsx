"use client";

/**
 * Аварийный экран, когда упал сам корневой layout: рендерит собственные
 * <html>/<body>, стили только инлайновые — ни токенов, ни CSS Modules здесь
 * уже нет. Палитра повторяет бренд (песок #f3efe6, алый #c23a29).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f3efe6",
          color: "#1f1b16",
          fontFamily:
            "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.8rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#c23a29",
            }}
          >
            Ошибка
          </p>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.6rem", lineHeight: 1.3 }}>
            Что-то пошло не так
          </h1>
          <p style={{ margin: "0.75rem 0 1.5rem", lineHeight: 1.6, color: "#5d564c" }}>
            Мы уже разбираемся. Попробуйте обновить страницу или вернитесь на
            главную.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                appearance: "none",
                border: "none",
                cursor: "pointer",
                background: "#c23a29",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                borderRadius: "999px",
                fontSize: "0.95rem",
                fontFamily: "inherit",
              }}
            >
              Попробовать снова
            </button>
            {/* Обычный <a>: клиентский роутер внутри global-error уже мёртв. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                display: "inline-block",
                border: "1px solid #cdc2ad",
                color: "#1f1b16",
                textDecoration: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "999px",
                fontSize: "0.95rem",
              }}
            >
              На главную
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
