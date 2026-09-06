import { dim } from "./ansi.js";

/** Formats a `Date` (stored/queried in UTC) for display in the user's local timezone. */
export function formatLocalDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Only the wall-clock part (`14:05`) — for rows where the date is already shown. */
export function formatLocalTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** `1h 23m`, `45m`, `<1m`. Seconds are dropped on purpose: entries are billed in minutes. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(ms, 0) / 60_000);
  if (totalMinutes < 1) return "<1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Decimal hours with two places (`1.25h`) — the unit reports and invoices bill in. */
export function formatHours(ms: number): string {
  return `${(ms / 3_600_000).toFixed(2)}h`;
}

/** The first 8 characters of a UUID — unique enough in practice and accepted by `edit`/`rm`. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/** Renders a possibly-empty value, greying out the placeholder. */
export function orDash(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? dim("—") : value;
}
