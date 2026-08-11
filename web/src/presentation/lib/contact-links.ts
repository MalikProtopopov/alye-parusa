/** Turns loosely formatted CMS contact values into proper hrefs. */

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://wa.me/${value.replace(/\D/g, "")}`;
}

export function telegramHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://t.me/${value.replace(/^@/, "")}`;
}
