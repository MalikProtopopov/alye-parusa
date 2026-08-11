/** Shared ru-RU formatters — one Intl instance per shape, SSR-stable. */

const priceFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const areaFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatPriceRub(value: number): string {
  return `${priceFmt.format(Math.round(value))} ₽`;
}

export function formatAreaM2(value: number): string {
  // неразрывный пробел: число и единица не должны расходиться по строкам
  return `${areaFmt.format(value)}\u00A0м²`;
}

export function formatDateRu(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return dateFmt.format(date);
}
