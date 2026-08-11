import { RU_PHONE_NATIONAL_LENGTH, RU_PHONE_PLACEHOLDER, ruPhoneNationalDigits } from "./phone";

/** Backend accepts a longer text, but a landing comment never needs more. */
export const MESSAGE_MAX_LENGTH = 1000;

/** Collapses inner runs of whitespace — "Иван   Петров" → "Иван Петров". */
export function normalizeLeadName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Russian error message for the name field, or null when it is fine. */
export function validateLeadName(raw: string): string | null {
  const name = normalizeLeadName(raw);
  if (name.length === 0) return "Укажите, как к вам обращаться.";
  if (name.length < 2) return "Имя слишком короткое — минимум 2 символа.";
  const letters = name.match(/\p{L}/gu) ?? [];
  if (letters.length < 2) return "Имя должно состоять из букв, а не из цифр или символов.";
  return null;
}

/** Russian error message for the phone field, or null when it is fine. */
export function validateLeadPhone(raw: string): string | null {
  const digits = ruPhoneNationalDigits(raw);
  if (digits.length === 0) return "Укажите телефон — на него позвонит менеджер.";
  if (digits.length < RU_PHONE_NATIONAL_LENGTH) {
    return `Номер неполный — нужно 11 цифр, например ${RU_PHONE_PLACEHOLDER}.`;
  }
  return null;
}

/** Russian error message for the optional comment, or null when it is fine. */
export function validateLeadMessage(raw: string): string | null {
  if (raw.length > MESSAGE_MAX_LENGTH) {
    return `Сообщение слишком длинное — максимум ${MESSAGE_MAX_LENGTH} символов.`;
  }
  return null;
}
