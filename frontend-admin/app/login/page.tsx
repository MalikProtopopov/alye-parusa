"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API, ApiError, apiFetch, clearAuth, getToken, setAuth } from "../lib/api";
import type { LoginResponse, Me } from "../lib/types";
import { EyeIcon, EyeOffIcon } from "../components/icons";

// Возвратный URL после входа (?next=/leads?lead=…): только внутренние пути —
// «/» без «//» (protocol-relative) и не сам /login.
function safeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  if (next === "/login" || next.startsWith("/login?")) return null;
  return next;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Токен в localStorage есть, но живая ли сессия — ещё неизвестно.
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  // Уже авторизован — уводим внутрь (учитывая возвратный URL). По одному лишь
  // наличию токена редиректить нельзя: после 401 на мутации токен сознательно
  // не чистится, и протухший ключ запирал бы пользователя вне админки —
  // /login мгновенно отправлял бы его на /dashboard и обратно. Проверяем
  // сессию запросом (on401: "silent" — редирект и очистку делаем сами).
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    apiFetch<Me>("/api/v1/admin/auth/me", { on401: "silent" })
      .then(() => {
        if (!cancelled) router.replace(nextUrl ?? "/dashboard");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Токен недействителен — убираем его и показываем форму.
        // Сеть/сервер недоступны — тоже показываем: вход всё равно нужен.
        if (err instanceof ApiError && err.status === 401) clearAuth();
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, nextUrl]);

  if (checking) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <span className="spin" aria-label="Проверяем сессию" />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Данные берём из DOM (FormData), а не только из state: автозаполнение
      // менеджера паролей (Safari/iCloud Keychain) может не дёрнуть onChange —
      // из state тогда ушли бы пустые строки при визуально заполненной форме.
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const emailValue = String(fd.get("email") ?? "") || email;
      const passwordValue = String(fd.get("password") ?? "") || password;

      // Логин без Bearer-токена; напрямую через fetch, чтобы разобрать 401.
      const res = await fetch(`${API}/api/v1/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      if (!res.ok) {
        // «Неверный пароль» — только про 401/422; 5xx от упавшего бэкенда —
        // честное «сервер недоступен», а не ложное обвинение пользователя.
        let detail =
          res.status === 401 || res.status === 422
            ? "Неверный email или пароль"
            : `Сервер временно недоступен (${res.status}) — попробуйте позже`;
        if (res.status === 401) {
          try {
            const data = await res.json();
            if (data && typeof data.detail === "string") detail = data.detail;
          } catch {
            /* тело без JSON — оставляем дефолтный текст */
          }
        }
        throw new ApiError(res.status, detail);
      }
      const data: LoginResponse = await res.json();
      setAuth(data.access_token, data.role);
      router.replace(nextUrl ?? "/dashboard");
    } catch (err) {
      // Сетевые сбои fetch — не «Failed to fetch», а по-русски.
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось соединиться с сервером — проверьте интернет"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "var(--sp-5)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "var(--sp-6)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt="Алые Паруса — знак"
            width={56}
            height={64}
            style={{ display: "block", margin: "0 auto var(--sp-3)" }}
          />
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "1.5rem",
              color: "var(--ink)",
            }}
          >
            Алые Паруса
          </div>
          <div
            className="eyebrow"
            style={{ color: "var(--accent)", fontSize: "var(--fs-caption)" }}
          >
            Админка
          </div>
        </div>

        <form className="card" onSubmit={onSubmit}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "var(--sp-5)" }}>
            Вход
          </h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">
              Пароль
            </label>
            <div className="input-wrap">
              <input
                id="password"
                name="password"
                className="input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                className="eye-btn"
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "Вход…" : "Войти"}
          </button>

          {/* Демо-доступы показываются только в демо-окружении
              (NEXT_PUBLIC_SHOW_DEMO_CREDS=1); в проде блока нет. */}
          {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDS === "1" && (
            <div
              className="field-hint"
              style={{ marginTop: "var(--sp-5)", lineHeight: 1.7 }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                Демо-доступы:
              </div>
              <div>
                Суперадмин:{" "}
                <span className="mono">admin@alyeparusa.local</span> /{" "}
                <span className="mono">admin12345</span>
              </div>
              <div>
                Менеджер:{" "}
                <span className="mono">manager@alyeparusa.local</span> /{" "}
                <span className="mono">manager12345</span>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// useSearchParams требует Suspense-границу при статической генерации.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
