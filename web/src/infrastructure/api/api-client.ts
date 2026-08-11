import "server-only";

/**
 * Thin fetch wrapper over the CMS API (FastAPI, prefix /api/v1).
 * Server-only: SSR/ISR data flows through here; the browser talks to the API
 * only via leads-client.ts. 404 → null (caller decides), network/5xx → throw
 * (adapters catch per-method and fall back to static content).
 */

const API_BASE =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Бекенд недоступен: сетевой сбой или 5xx. Slug-lookup адаптеры НЕ глотают
 * эту ошибку — деталка должна отдать честный 5xx, а не мягкий 404 (иначе
 * поисковик выкинет живую страницу из индекса при падении API).
 */
export class ApiUnavailableError extends ApiError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = "ApiUnavailableError";
  }
}

export interface ApiFetchOptions {
  /** ISR window in seconds. */
  revalidate?: number;
  /** Next cache tags for targeted revalidation. */
  tags?: string[];
  searchParams?: Record<string, string | number | boolean | undefined>;
}

export async function apiFetch<T>(
  path: string,
  { revalidate = 300, tags, searchParams }: ApiFetchOptions = {},
): Promise<T | null> {
  const url = new URL(`/api/v1${path}`, API_BASE);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate, tags } });
  } catch (cause) {
    throw new ApiUnavailableError(
      `API unreachable for ${path}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
  if (res.status === 404) return null;
  if (res.status >= 500) {
    throw new ApiUnavailableError(`API ${res.status} for ${path}`, res.status);
  }
  if (!res.ok) {
    throw new ApiError(`API ${res.status} for ${path}`, res.status);
  }
  return (await res.json()) as T;
}
