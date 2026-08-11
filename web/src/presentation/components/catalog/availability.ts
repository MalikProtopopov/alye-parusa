import type { AvailabilityStatus } from "@/domain";

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "В продаже",
  reserved: "Забронировано",
  sold: "Продано",
};
