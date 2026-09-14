import type { Filter } from "./filter.ts";
import { DAY_MS, TZ, now } from "./data.ts";

// Date windows for searches. The step-by-step search picks a label ("this_weekend"); the chat agent gives dates.

export type When = "tonight" | "today" | "tomorrow" | "this_saturday" | "this_sunday" | "this_weekend" | "this_week";

// Bangkok calendar date (YYYY-MM-DD) that is `offset` days from today.
export function bkkDate(offset: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now().getTime() + offset * DAY_MS));
}

const at = (date: string, hms: string) => `${date}T${hms}+07:00`;

export function rangeFor(when: When): { start: string; end: string } {
  const whole = (from: number, to = from) => ({ start: at(bkkDate(from), "00:00:00"), end: at(bkkDate(to), "23:59:59") });
  const dow = new Date(`${bkkDate(0)}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const toSat = (6 - dow + 7) % 7;
  switch (when) {
    case "tonight": return { start: at(bkkDate(0), "18:00:00"), end: at(bkkDate(0), "23:59:59") };
    case "today": return whole(0);
    case "tomorrow": return whole(1);
    case "this_saturday": return whole(toSat);
    case "this_sunday": return whole((7 - dow) % 7);
    case "this_weekend": return dow === 0 ? whole(0) : whole(toSat, toSat + 1);
    case "this_week": return whole(0, 6);
  }
}

// Whole days from `from` to `to` (YYYY-MM-DD), optionally starting at a time of day ("18:00").
export function dayRange(from: string, to = from, afterTime?: string | null): { start: string; end: string } {
  const time = afterTime && /^\d{2}:\d{2}$/.test(afterTime) ? `${afterTime}:00` : "00:00:00";
  return { start: at(from, time), end: at(to < from ? from : to, "23:59:59") };
}

// Never recommend something that has already finished: the window starts no earlier than now, and defaults to 30 days.
export function windowFrom(range: { start: string | null; end: string | null }): Filter["date_range"] {
  const nowMs = now().getTime();
  const startMs = Math.max(nowMs, range.start ? Date.parse(range.start) : nowMs);
  const endMs = range.end ? Date.parse(range.end) : startMs + 30 * DAY_MS;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}
