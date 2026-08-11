/**
 * First-touch UTM attribution: the labels the visitor arrived with are kept
 * for the whole browser session and attached to every lead. Browser-only —
 * call from client components; every access is guarded for private mode.
 */
const STORAGE_KEY = "ap-utm";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/** Store the landing page's UTM labels once per session (first touch wins). */
export function captureUtm(): void {
  try {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    }
  } catch {
    /* sessionStorage unavailable (private mode) — leads go without UTM */
  }
}

export function getUtm(): Record<string, string> | undefined {
  try {
    captureUtm();
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
