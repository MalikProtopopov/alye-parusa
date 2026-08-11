// Клиент API + работа с токеном авторизации (localStorage).

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const TOKEN_KEY = "ap_admin_token";
export const ROLE_KEY = "ap_admin_role";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ROLE_KEY);
}

export function setAuth(token: string, role: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

// Ошибка API с HTTP-статусом (пользовательское сообщение в message).
// data — сырой detail из тела ошибки (строка-код, pydantic-массив 422,
// объект вида {code, used_by} и т.п.) для перевода в lib/errors.ts.
export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // по умолчанию true — добавляем Bearer-токен
  /**
   * Поведение при 401:
   *  - "redirect" — очистить сессию и увести на /login?next=… (по умолчанию
   *    для GET: загрузка страницы, терять нечего);
   *  - "silent" — просто бросить ApiError(401) без очистки токена и без
   *    навигации (по умолчанию для мутаций: форма остаётся смонтированной
   *    со всеми данными; фоновые поллинги передают явно).
   */
  on401?: "redirect" | "silent";
}

/** Сообщение для 401 на мутациях: форма не размонтируется, данные целы. */
export const SESSION_EXPIRED_MESSAGE =
  "Сессия истекла — войдите заново в новой вкладке, данные формы сохранятся";

/**
 * Обёртка над fetch:
 *  - подставляет Bearer-токен;
 *  - 401 на GET → чистим localStorage и уводим на /login?next=…;
 *    401 на мутациях → бросаем ApiError(401) БЕЗ редиректа (данные формы целы);
 *  - 403 → «Недостаточно прав»;
 *  - парсит detail из тела ошибки;
 *  - корректно обрабатывает 204/пустое тело.
 */
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Не удалось соединиться с сервером");
  }

  if (res.status === 401) {
    const behavior = options.on401 ?? (method === "GET" ? "redirect" : "silent");
    if (behavior === "redirect" && typeof window !== "undefined") {
      clearAuth();
      // Возвратный URL: после входа пользователь попадает туда, куда шёл.
      const here = window.location.pathname + window.location.search;
      const next =
        window.location.pathname !== "/login" && here.startsWith("/")
          ? `?next=${encodeURIComponent(here)}`
          : "";
      window.location.href = `/login${next}`;
      throw new ApiError(401, "Сессия истекла, войдите заново");
    }
    // Мутации/фоновые запросы: НЕ чистим токен и НЕ навигируем — форма
    // остаётся смонтированной, данные можно сохранить после повторного входа.
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE);
  }

  if (!res.ok) {
    let detail = `Ошибка сервера (${res.status})`;
    let raw: unknown;
    try {
      const data = await res.json();
      if (data && data.detail !== undefined) {
        raw = data.detail;
        // Только строковый detail показываем как есть; массивы/объекты
        // (pydantic-422, media_in_use…) переводит lib/errors.ts по .data.
        if (typeof data.detail === "string") detail = data.detail;
      }
    } catch {
      /* тело без JSON — оставляем дефолтный текст */
    }
    if (res.status === 403) detail = "Недостаточно прав";
    throw new ApiError(res.status, detail, raw);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
