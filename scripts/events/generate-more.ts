// Grows scoop-mock-data-bkk.json from 500 to 1000 events by adding mock events at real venues from scoop-venues-bkk.json.
// Each new event copies the style of an existing event of the same kind (title, description, clock times, price,
// guide, photo) and moves it to another venue and day. Venues no event uses yet are filled first.
// The eval_set in the JSON must give the same answers afterwards, so an event that would change one is moved to
// another day. Re-running rebuilds e501 onwards from scratch and gives the same result (fixed random seed).
//   node scripts/events/generate-more.ts
import { readFileSync, writeFileSync } from "node:fs";
import { blockingConstraint, filterEvents } from "../../src/filter.ts";
import type { Event, Filter } from "../../src/filter.ts";

type Venue = {
  id: string; category: string; name_en: string; name_th: string; lat: number; lng: number;
  phone: string | null; website: string | null; google_maps_url?: string;
  nearest_station: { name_en: string }; transit_en: string; transit_th: string;
};
type StoredEvent = Event & { venue: Event["venue"] & { venue_id?: string; google_maps_url?: string } };
type EvalCase = { id: string; filter: Filter; expected_ids: string[] };

const TOTAL = 1000;
const FIRST_DAY = "2026-09-14"; // 13 Sep is left as it is: the "tonight, party of 6" eval case is about that evening
const LAST_DAY = "2026-10-04";
// Same mix of kinds as the first 500 events.
const MIX: Record<string, number> = { food: 105, art: 92, sports: 91, market: 80, nightlife: 35, music: 34, workshop: 27, film: 22, comedy: 14 };
// Which venue categories each kind of event can be held at (as in the first 500).
const VENUE_KINDS: Record<string, string[]> = { food: ["food", "market"], art: ["art"], sports: ["sports"], market: ["market"], nightlife: ["nightlife"], music: ["music", "nightlife"], workshop: ["workshop"], film: ["film"], comedy: ["comedy"] };

const dataFile = new URL("../../scoop-mock-data-bkk.json", import.meta.url);
const data = JSON.parse(readFileSync(dataFile, "utf8")) as { meta: Record<string, string>; events: StoredEvent[]; eval_set: EvalCase[] };
const venues = (JSON.parse(readFileSync(new URL("../../scoop-venues-bkk.json", import.meta.url), "utf8")) as { venues: Venue[] }).venues;
const venueById = new Map(venues.map((v) => [v.id, v]));

// Deterministic random numbers, so the file only changes when this script does.
let seed = 20260914;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const base = data.events.filter((e) => Number(e.id.slice(1)) <= 500);
// Only titles that can move: generic ones used at two or more venues ("Quiz Night"), or ones naming their own venue,
// which gets swapped for the new one. A title naming another place ("Benjakitti Skywalk Morning Run") stays put.
const venuesPerTitle = new Map<string, Set<string>>();
for (const e of base) venuesPerTitle.set(e.title_en, (venuesPerTitle.get(e.title_en) ?? new Set()).add(e.venue.name_en));
const templates = base.filter((e) => e.venue.venue_id && venueById.has(e.venue.venue_id) && (venuesPerTitle.get(e.title_en)!.size >= 2 || e.title_en.includes(e.venue.name_en)));

const days: string[] = [];
for (let d = new Date(`${FIRST_DAY}T12:00:00+07:00`); d <= new Date(`${LAST_DAY}T12:00:00+07:00`); d = new Date(d.getTime() + 86400000)) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
  const weekend = [0, 5, 6].includes(new Date(`${iso}T12:00:00+07:00`).getUTCDay()); // Fri–Sun are busier
  days.push(...(weekend ? [iso, iso] : [iso]));
}

const uses = new Map<string, number>();
for (const e of base) if (e.venue.venue_id) uses.set(e.venue.venue_id, (uses.get(e.venue.venue_id) ?? 0) + 1);
function chooseVenue(kind: string): Venue {
  const pool = venues.filter((v) => VENUE_KINDS[kind].includes(v.category));
  const least = Math.min(...pool.map((v) => uses.get(v.id) ?? 0));
  const v = pick(pool.filter((p) => (uses.get(p.id) ?? 0) === least));
  uses.set(v.id, (uses.get(v.id) ?? 0) + 1);
  return v;
}

// A title that names a day keeps to it, as in the first 500: "Weekend Tournament" and brunches on Saturday or Sunday.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+07:00`).getUTCDay()];
function daysFor(title: string): string[] {
  const t = title.toLowerCase();
  const named = WEEKDAYS.filter((w) => t.includes(w));
  const allowed = named.length ? named : /weekend|brunch/.test(t) ? ["saturday", "sunday"] : WEEKDAYS;
  return days.filter((d) => allowed.includes(weekdayOf(d)));
}

const swap = (text: string, from: string, to: string) => (from && text.includes(from) ? text.split(from).join(to) : text);
const roundTo = (n: number, step: number) => Math.max(0, Math.round(n / step) * step);

function makeEvent(id: string, t: StoredEvent, v: Venue, day: string): StoredEvent {
  const clock = (iso: string) => iso.slice(10); // "T19:00:00+07:00"
  const endsNextDay = t.end_datetime.slice(0, 10) > t.start_datetime.slice(0, 10);
  const endDay = endsNextDay ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(new Date(`${day}T12:00:00+07:00`).getTime() + 86400000)) : day;
  const scale = 0.8 + rand() * 0.5;
  const priceMin = t.price_thb_min === 0 ? 0 : roundTo(t.price_thb_min * scale, 10);
  const r = rand();
  const seats = r < 0.06 ? 0 : r < 0.18 ? 1 + Math.floor(rand() * 4) : Math.max(5, Math.round(t.seats_remaining * (0.5 + rand())));
  const oldV = t.venue;
  const e: StoredEvent = {
    ...t,
    id,
    title_en: swap(t.title_en, oldV.name_en, v.name_en),
    title_th: swap(swap(t.title_th, oldV.name_th, v.name_th), oldV.name_en, v.name_th),
    start_datetime: `${day}${clock(t.start_datetime)}`,
    end_datetime: `${endDay}${clock(t.end_datetime)}`,
    price_thb_min: priceMin,
    price_thb_max: t.price_thb_max === 0 ? 0 : Math.max(priceMin, roundTo(t.price_thb_max * scale, 10)),
    seats_remaining: seats,
    status: rand() < 0.05 ? "cancelled" : "active",
    venue: {
      venue_id: v.id, name_en: v.name_en, name_th: v.name_th, area: v.nearest_station.name_en, lat: v.lat, lng: v.lng,
      phone: v.phone, contact_person: null, website: v.website,
      google_maps_url: v.google_maps_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name_en}, ${v.nearest_station.name_en}, Bangkok`)}`,
    },
    transit_en: v.transit_en,
    transit_th: v.transit_th,
  };
  if (t.guide) {
    e.guide = {
      ...t.guide,
      meeting_point_en: swap(t.guide.meeting_point_en, oldV.name_en, v.name_en),
      meeting_point_th: swap(swap(t.guide.meeting_point_th, oldV.name_th, v.name_th), oldV.name_en, v.name_th),
    };
  }
  return e;
}

// Same results for every case, and for the empty ones the same "which filter blocked it" as the first 500 give.
const blockedBy = new Map(data.eval_set.filter((c) => c.expected_ids.length === 0).map((c) => [c.id, blockingConstraint(data.events.filter((e) => Number(e.id.slice(1)) <= 500), c.filter)]));
const evalsUnchanged = (events: Event[]) =>
  data.eval_set.every((c) => JSON.stringify(filterEvents(events, c.filter).map((e) => e.id)) === JSON.stringify(c.expected_ids)) &&
  [...blockedBy].every(([id, constraint]) => blockingConstraint(events, data.eval_set.find((c) => c.id === id)!.filter) === constraint);
if (!evalsUnchanged(base)) throw new Error("eval_set already fails on the first 500 events; fix that first");

const events: StoredEvent[] = [...base];
const kinds = Object.entries(MIX).flatMap(([k, n]) => Array<string>(n).fill(k)).sort(() => rand() - 0.5);
let moved = 0;
kinds.slice(0, TOTAL - base.length).forEach((kind, i) => {
  const id = `e${base.length + i + 1}`;
  const v = chooseVenue(kind);
  // Model it on an event held at the same type of venue, so a wine pairing doesn't land in a street market.
  const sameVenueType = templates.filter((x) => x.category === kind && venueById.get(x.venue.venue_id!)!.category === v.category);
  const t = pick(sameVenueType.length ? sameVenueType : templates.filter((x) => x.category === kind));
  const allowedDays = daysFor(t.title_en);
  for (let attempt = 0; ; attempt++) {
    const e = makeEvent(id, t, v, pick(allowedDays));
    if (evalsUnchanged([...events, e])) { events.push(e); break; }
    moved++;
    if (attempt > 50) throw new Error(`no day fits ${id} without changing eval_set`);
  }
});

data.events = events;
data.meta.note = "Mock data. Dates cover 2026-09-13 to 2026-10-04. e01-e29 are fully mock; e30+ are mock events placed at real venues from scoop-venues-bkk.json (location, phone, website, nearest station © OpenStreetMap contributors, ODbL) - venue.venue_id links back to that file and venue.google_maps_url opens a Google Maps search for the venue. Event titles, times, prices and seats are invented. e501-e1000 were added by scripts/events/generate-more.ts from the same event styles.";
data.meta.images_note = "image_path is a 640px copy in assets/events/ served by the bot at /assets; image_url is the original Wikimedia Commons thumbnail. e501+ reuse the photo of the event they were modelled on. Every photo is CC BY / CC BY-SA / CC0 / public domain - image_credit and image_source give the author and licence page.";
writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");

const byKind: Record<string, number> = {};
for (const e of events.slice(base.length)) byKind[e.category] = (byKind[e.category] ?? 0) + 1;
const used = new Set(events.map((e) => e.venue.venue_id).filter(Boolean));
console.log(`events: ${events.length} (added ${events.length - base.length}: ${JSON.stringify(byKind)})`);
console.log(`venues with at least one event: ${used.size} of ${venues.length} · cancelled: ${events.filter((e) => e.status === "cancelled").length} · moved to keep eval_set: ${moved}`);
