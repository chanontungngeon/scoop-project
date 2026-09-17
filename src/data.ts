import { readFileSync } from "node:fs";
import type { Event } from "./filter.ts";

export const TZ = "Asia/Bangkok";
export const DAY_MS = 24 * 60 * 60 * 1000;

const data = JSON.parse(readFileSync(new URL("../scoop-mock-data-bkk.json", import.meta.url), "utf8")) as { events: Event[] };
export const EVENTS = data.events;
export const CATEGORIES = [...new Set(EVENTS.map((e) => e.category))].sort();
// What sports events are: "tennis", "wakeboard", "climbing" ... ("sports_ground" is a general pitch, not something to search for).
export const ACTIVITIES = [...new Set(EVENTS.flatMap((e) => (e.activity && e.activity !== "sports_ground" ? [e.activity] : [])))].sort();

// DEMO_NOW (e.g. 2026-09-13T20:00:00+07:00) pins "now" so the mock data's dates stay relevant.
export const now = () => (process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date());
