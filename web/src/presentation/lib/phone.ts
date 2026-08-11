/** Digits after the country code. */
export const RU_PHONE_NATIONAL_LENGTH = 10;

/**
 * Client mirror of the backend's normalize_ru_phone: a Russian number has 10
 * digits after the country code. Accepts "8 (999) 123-45-67", "+7 999 …",
 * "9991234567" → "+79991234567"; anything else → null.
 * A leading 7/8 always counts as the country/trunk code — the same reading the
 * input mask shows the user, so "+7 (999) 123-45-6" is incomplete, not a
 * ten-digit number starting with seven.
 */
export function normalizeRuPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national =
    digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  if (national.length !== RU_PHONE_NATIONAL_LENGTH) return null;
  return `+7${national}`;
}

export function isValidRuPhone(input: string): boolean {
  return normalizeRuPhone(input) !== null;
}
/** The shape the input field masks to. */
export const RU_PHONE_PLACEHOLDER = "+7 (999) 123-45-67";
/** Everything before the first national digit: "+7 (". */
const PREFIX_LENGTH = 4;

const isDigit = (char: string | undefined) => char !== undefined && char >= "0" && char <= "9";

const countDigits = (text: string) => (text.match(/\d/g) ?? []).length;

/**
 * The 10 national digits of whatever the user typed or pasted. A leading 7/8
 * is the country/trunk code and is dropped, so "8 999…" and "+7 999…" agree.
 */
export function ruPhoneNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  const national =
    digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  return national.slice(0, RU_PHONE_NATIONAL_LENGTH);
}

/** Progressive mask: "999123" → "+7 (999) 123", "" → "". */
export function formatRuPhone(input: string): string {
  const digits = ruPhoneNationalDigits(input);
  if (digits.length === 0) return "";
  let masked = `+7 (${digits.slice(0, 3)}`;
  if (digits.length > 3) masked += `) ${digits.slice(3, 6)}`;
  if (digits.length > 6) masked += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) masked += `-${digits.slice(8, 10)}`;
  return masked;
}

/** Caret position right after the `count`-th national digit of a masked value. */
function caretAfterDigits(masked: string, count: number): number {
  if (masked.length === 0) return 0;
  if (count <= 0) return Math.min(PREFIX_LENGTH, masked.length);
  let seen = 0;
  for (let i = PREFIX_LENGTH - 1; i < masked.length; i += 1) {
    if (isDigit(masked[i])) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return masked.length;
}

export interface MaskedPhone {
  value: string;
  caret: number;
}

/**
 * Reformats raw field content (typing, pasting, replacing a selection) and
 * puts the caret back after the same digit the user was standing on.
 */
export function applyPhoneMask(raw: string, caret: number): MaskedPhone {
  const value = formatRuPhone(raw);
  const digits = raw.replace(/\D/g, "");
  const countryOffset = digits.startsWith("7") || digits.startsWith("8") ? 1 : 0;
  const national = ruPhoneNationalDigits(raw);
  const digitsBefore = countDigits(raw.slice(0, Math.max(0, caret)));
  const nationalBefore = Math.min(Math.max(digitsBefore - countryOffset, 0), national.length);
  return { value, caret: caretAfterDigits(value, nationalBefore) };
}

/**
 * Backspace on a mask separator ("+7 (999) |123") must eat the digit before it,
 * not the punctuation the mask would immediately restore.
 */
export function deletePhoneDigitBefore(value: string, caret: number): MaskedPhone {
  let index = -1;
  for (let i = Math.min(caret, value.length) - 1; i >= 0; i -= 1) {
    if (isDigit(value[i])) {
      index = i;
      break;
    }
  }
  if (index < 0) return { value: formatRuPhone(value), caret: 0 };
  return applyPhoneMask(value.slice(0, index) + value.slice(caret), index);
}
