/** Cookie/analytics consent (152-ФЗ): stored per browser, granted explicitly. */

export const CONSENT_KEY = "ap-cookie-consent";
export const CONSENT_EVENT = "ap-consent-granted";

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* private mode — consent lives for the tab only */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
