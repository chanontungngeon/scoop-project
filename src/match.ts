import type { Event } from "./filter.ts";
import { VIBES } from "./flex.ts";
import type { VibeId } from "./flex.ts";
import { distM } from "./rail.ts";
import type { Point } from "./ride.ts";

// How well an event fits this user, as a percentage, from what Scoop knows about them:
// their vibe, what they've booked before, usual budget and group size, and distance if they've shared a location.
// LINE itself only shares a display name and photo, so there's no interest data from LINE.

export type Profile = {
  name?: string; // for the intro line only
  vibe?: VibeId;
  bookedCategories: string[];
  usualBudget?: number | null;
  usualPeople?: number | null;
  origin?: Point;
  now: Date;
};

export type Reason =
  | { kind: "vibe"; vibe: VibeId }
  | { kind: "history"; category: string }
  | { kind: "budget" }
  | { kind: "near"; km: number }
  | { kind: "group"; people: number }
  | { kind: "soon" }
  | { kind: "free" };

export type Match = { score: number; reasons: Reason[] };

// Each factor is 0–1; weights add up to 1. The score maps the weighted sum onto 35–99%.
const WEIGHTS = { category: 0.4, budget: 0.2, distance: 0.15, timing: 0.15, group: 0.1 };

export function matchEvent(e: Event, p: Profile): Match {
  const reasons: { weight: number; reason: Reason }[] = [];

  // Kind of event: their vibe, or something they've booked before.
  const inVibe = p.vibe ? VIBES[p.vibe].categories.includes(e.category) : false;
  const bookedBefore = p.bookedCategories.includes(e.category);
  const category = inVibe && bookedBefore ? 1 : inVibe ? 0.9 : bookedBefore ? 0.75 : p.vibe || p.bookedCategories.length ? 0.2 : 0.5;
  if (inVibe) reasons.push({ weight: WEIGHTS.category * 0.9, reason: { kind: "vibe", vibe: p.vibe! } });
  if (bookedBefore) reasons.push({ weight: WEIGHTS.category * (inVibe ? 0.3 : 0.75), reason: { kind: "history", category: e.category } });

  // Price: within their usual budget, and the cheaper the better.
  const cost = e.price_thb_min;
  let budget: number;
  if (typeof p.usualBudget === "number") {
    budget = p.usualBudget === 0 ? (cost === 0 ? 1 : 0) : cost <= p.usualBudget ? 1 - 0.5 * (cost / p.usualBudget) : Math.max(0, 0.4 * (1 - (cost - p.usualBudget) / p.usualBudget));
    if (cost <= p.usualBudget) reasons.push({ weight: WEIGHTS.budget * budget, reason: { kind: "budget" } });
  } else {
    budget = cost === 0 ? 0.85 : cost <= 300 ? 0.7 : cost <= 1000 ? 0.5 : 0.3;
  }
  if (e.price_thb_max === 0) reasons.push({ weight: WEIGHTS.budget * 0.6, reason: { kind: "free" } });

  // Distance from their last shared location; neutral when we don't know where they are.
  let distance = 0.5;
  if (p.origin) {
    const km = distM(p.origin, { lat: e.venue.lat, lng: e.venue.lng }) / 1000;
    distance = Math.max(0, 1 - km / 15);
    if (km <= 5) reasons.push({ weight: WEIGHTS.distance * distance, reason: { kind: "near", km: Math.max(0.5, Math.round(km * 2) / 2) } });
  }

  // Sooner is better, fading out over two weeks.
  const daysAway = Math.max(0, (Date.parse(e.start_datetime) - p.now.getTime()) / 86_400_000);
  const timing = 1 - Math.min(daysAway, 14) / 14;
  if (daysAway <= 2) reasons.push({ weight: WEIGHTS.timing * timing, reason: { kind: "soon" } });

  // Enough seats for the group they usually go with.
  let group = 0.7;
  if (typeof p.usualPeople === "number") {
    group = e.seats_remaining >= p.usualPeople ? 1 : 0;
    if (group && p.usualPeople > 1) reasons.push({ weight: WEIGHTS.group, reason: { kind: "group", people: p.usualPeople } });
  }

  const sum = WEIGHTS.category * category + WEIGHTS.budget * budget + WEIGHTS.distance * distance + WEIGHTS.timing * timing + WEIGHTS.group * group;
  return {
    score: Math.round(35 + 64 * sum),
    reasons: reasons.sort((a, b) => b.weight - a.weight).slice(0, 2).map((r) => r.reason),
  };
}

// With nothing to go on (no vibe, bookings, usual budget or group, or location) every event scores the same,
// so the percentage would look precise and mean nothing.
export const hasSignals = (p: Profile) =>
  Boolean(p.vibe || p.bookedCategories.length || typeof p.usualBudget === "number" || typeof p.usualPeople === "number" || p.origin);

// Best match first; ties go to whatever starts sooner. Repeat sessions of the same event show once (the best fit).
export function rankEvents(events: Event[], p: Profile, limit: number) {
  const seen = new Set<string>();
  return events
    .map((e) => ({ e, m: matchEvent(e, p) }))
    .sort((a, b) => b.m.score - a.m.score || Date.parse(a.e.start_datetime) - Date.parse(b.e.start_datetime))
    .filter(({ e }) => !seen.has(e.title_en) && Boolean(seen.add(e.title_en)))
    .slice(0, limit);
}
