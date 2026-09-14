import { readFileSync } from "node:fs";
import type { Event } from "./filter.ts";
import type { Point } from "./ride.ts";

// BTS / MRT / Airport Rail Link / Gold Line route planner. Stations come from scoop-venues-bkk.json (OpenStreetMap).
// Lines are built from station codes, which run in order along each line; the MRT Blue Line loop (BL32 -> BL01,
// then the branch BL01 -> BL33) was checked against the OpenStreetMap route relation.
// Times and fares are estimates. Fares are distance-based since Nov 2025: BTS about ฿17–65, MRT Blue about ฿17–45
// per trip, and BTS and MRT are paid separately when you change between them.

export type Station = { ref: string; system: string; line: string; name_en: string; name_th: string; lat: number; lng: number };

export type LineId = "bts_sukhumvit" | "bts_silom" | "mrt_blue" | "mrt_purple" | "mrt_yellow" | "mrt_pink" | "arl" | "gold";

type LineDef = { id: LineId; operator: "BTS" | "MRT" | "ARL" | "GOLD"; codes: string[]; minPerStop: number };

const range = (prefix: string, from: number, to: number, pad = 0) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(pad, "0")}`);

const LINES: LineDef[] = [
  { id: "bts_sukhumvit", operator: "BTS", minPerStop: 2.3, codes: [...range("N", 7, 24).reverse(), "N5", "N4", "N3", "N2", "N1", "CEN", ...range("E", 1, 23)] }, // there is no N6
  { id: "bts_silom", operator: "BTS", minPerStop: 2.3, codes: ["W1", "CEN", ...range("S", 1, 12)] },
  { id: "mrt_blue", operator: "MRT", minPerStop: 2.2, codes: [...range("BL", 1, 32, 2), "BL01", ...range("BL", 33, 38, 2)] }, // BL32 -> BL01 closes the loop, BL01 -> BL33 is the branch
  { id: "mrt_purple", operator: "MRT", minPerStop: 2.4, codes: range("PP", 1, 16, 2) },
  { id: "mrt_yellow", operator: "MRT", minPerStop: 2.2, codes: range("YL", 1, 23, 2) },
  { id: "mrt_pink", operator: "MRT", minPerStop: 2.2, codes: range("PK", 1, 30, 2) },
  { id: "arl", operator: "ARL", minPerStop: 3.5, codes: range("A", 1, 8) },
  { id: "gold", operator: "GOLD", minPerStop: 2, codes: range("G", 1, 3) },
];

// Stations the map data lacks but a route can still pass through or be named after.
const EXTRA: Station[] = [
  { ref: "PP01", system: "MRT", line: "MRT Purple", name_en: "Khlong Bang Phai", name_th: "คลองบางไผ่", lat: 13.8928, lng: 100.4103 },
  { ref: "YL01", system: "MRT", line: "MRT Yellow", name_en: "Lat Phrao", name_th: "ลาดพร้าว", lat: 13.8062, lng: 100.5734 },
];

const TRANSFER_WALK_M = 450; // stations on different lines closer than this are an interchange
const WAIT_MIN = 4;
const TRANSFER_MIN = 5;
const WALK_M_PER_MIN = 75;
const WALK_DETOUR = 1.3;

const rad = (d: number) => (d * Math.PI) / 180;
export const distM = (a: Point, b: Point) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const walkMin = (m: number) => Math.max(1, Math.ceil((m * WALK_DETOUR) / WALK_M_PER_MIN));

const venuesFile = JSON.parse(readFileSync(new URL("../scoop-venues-bkk.json", import.meta.url), "utf8")) as { stations: Station[] };
const STATIONS = new Map<string, Station>([...EXTRA, ...venuesFile.stations].map((s) => [s.ref, s]));

// Graph node = "<line>|<code>". Ride edges along lines; transfer edges between nearby stations of different lines.
type Edge = { to: string; min: number; kind: "ride" | "transfer" };
const graph = new Map<string, Edge[]>();
const addEdge = (a: string, b: string, min: number, kind: Edge["kind"]) => {
  if (!graph.has(a)) graph.set(a, []);
  graph.get(a)!.push({ to: b, min, kind });
};
const node = (line: LineId, code: string) => `${line}|${code}`;

for (const l of LINES) {
  for (let i = 1; i < l.codes.length; i++) {
    const [a, b] = [node(l.id, l.codes[i - 1]), node(l.id, l.codes[i])];
    if (a === b) continue;
    addEdge(a, b, l.minPerStop, "ride");
    addEdge(b, a, l.minPerStop, "ride");
  }
}
const lineNodes = LINES.flatMap((l) => [...new Set(l.codes)].map((code) => ({ line: l.id, code, s: STATIONS.get(code) })));
for (const x of lineNodes) {
  for (const y of lineNodes) {
    if (x.line === y.line || !x.s || !y.s) continue;
    const d = x.code === y.code ? 0 : distM(x.s, y.s);
    if (d <= TRANSFER_WALK_M) addEdge(node(x.line, x.code), node(y.line, y.code), TRANSFER_MIN + walkMin(d), "transfer");
  }
}

const lineOf = (id: LineId) => LINES.find((l) => l.id === id)!;
const linesAt = (code: string) => LINES.filter((l) => l.codes.includes(code)).map((l) => l.id);

// Rough fare by operator and number of stops; a separate fare each time you enter another operator's system.
function fareFor(operator: LineDef["operator"], stops: number): number {
  switch (operator) {
    case "BTS": return Math.min(65, 17 + 4 * Math.max(0, stops - 1));
    case "MRT": return Math.min(45, 17 + 2.5 * Math.max(0, stops - 1));
    case "ARL": return Math.min(45, 15 + 5 * Math.max(0, stops - 1));
    case "GOLD": return 16;
  }
}

export type Leg =
  | { kind: "walk"; minutes: number; to: "station" | "venue"; station?: Station }
  | { kind: "ride"; line: LineId; from: Station; to: Station; towards: Station; stops: number; minutes: number }
  | { kind: "transfer"; minutes: number; at: Station };

export type TransitPlan = { legs: Leg[]; minutes: number; fare: number; leaveAt: Date; walkOnly: boolean };

function shortest(fromNodes: string[], toNodes: Set<string>) {
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const queue = new Set<string>();
  for (const n of fromNodes) { dist.set(n, 0); queue.add(n); }
  while (queue.size) {
    let cur = "";
    for (const n of queue) if (!cur || dist.get(n)! < dist.get(cur)!) cur = n;
    queue.delete(cur);
    if (toNodes.has(cur)) {
      const path = [cur];
      while (prev.has(path[0])) path.unshift(prev.get(path[0])!);
      return { path, minutes: dist.get(cur)! };
    }
    for (const e of graph.get(cur) ?? []) {
      const d = dist.get(cur)! + e.min;
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); prev.set(e.to, cur); queue.add(e.to); }
    }
  }
  return null;
}

const nearest = (p: Point, max: number, limit: number) =>
  [...STATIONS.values()]
    .map((s) => ({ s, d: distM(p, s) }))
    .filter((x) => x.d <= max && linesAt(x.s.ref).length > 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);

export function planTransit(from: Point, e: Event): TransitPlan | null {
  const venue = { lat: e.venue.lat, lng: e.venue.lng };
  const start = Date.parse(e.start_datetime);
  const direct = distM(from, venue);
  if (direct <= 1200) {
    const minutes = walkMin(direct);
    return { legs: [{ kind: "walk", minutes, to: "venue" }], minutes, fare: 0, leaveAt: new Date(start - (minutes + 10) * 60000), walkOnly: true };
  }

  let best: { plan: TransitPlan; total: number } | null = null;
  for (const o of nearest(from, 2500, 3)) {
    for (const t of nearest(venue, 1500, 2)) {
      if (o.s.ref === t.s.ref) continue;
      const res = shortest(linesAt(o.s.ref).map((l) => node(l, o.s.ref)), new Set(linesAt(t.s.ref).map((l) => node(l, t.s.ref))));
      if (!res) continue;
      const legs = toLegs(res.path);
      const walkIn = walkMin(o.d), walkOut = walkMin(t.d);
      const minutes = Math.round(walkIn + WAIT_MIN + res.minutes + walkOut);
      if (best && minutes >= best.total) continue;
      const fare = fareOf(legs);
      best = {
        total: minutes,
        plan: {
          legs: [{ kind: "walk", minutes: walkIn, to: "station", station: o.s }, ...legs, { kind: "walk", minutes: walkOut, to: "venue" }],
          minutes,
          fare,
          leaveAt: new Date(start - (minutes + 15) * 60000),
          walkOnly: false,
        },
      };
    }
  }
  return best?.plan ?? null;
}

function toLegs(path: string[]): Leg[] {
  const legs: Leg[] = [];
  let i = 0;
  while (i < path.length - 1) {
    const [lineA, codeA] = path[i].split("|") as [LineId, string];
    const [lineB, codeB] = path[i + 1].split("|") as [LineId, string];
    if (lineA !== lineB) {
      const edge = graph.get(path[i])!.find((x) => x.to === path[i + 1])!;
      legs.push({ kind: "transfer", minutes: edge.min, at: STATIONS.get(codeB)! });
      i++;
      continue;
    }
    let j = i + 1;
    while (j < path.length - 1 && path[j + 1].split("|")[0] === lineA) j++;
    const l = lineOf(lineA);
    const codes = path.slice(i, j + 1).map((n) => n.split("|")[1]);
    const stops = codes.length - 1;
    // Direction from the first pair of neighbouring codes (a code can appear twice on a loop line).
    const forward = l.codes.some((c, k) => c === codes[0] && l.codes[k + 1] === codes[1]);
    const terminal = forward ? l.codes[l.codes.length - 1] : l.codes[0];
    legs.push({ kind: "ride", line: lineA, from: STATIONS.get(codeA)!, to: STATIONS.get(codes[codes.length - 1])!, towards: STATIONS.get(terminal) ?? STATIONS.get(codeB)!, stops, minutes: Math.round(stops * l.minPerStop) });
    i = j;
  }
  return legs;
}

// One fare per stretch on the same operator (BTS Sukhumvit + Silom at Siam is one BTS trip).
function fareOf(legs: Leg[]): number {
  let total = 0;
  let op: LineDef["operator"] | null = null;
  let stops = 0;
  for (const leg of legs) {
    if (leg.kind !== "ride") continue;
    const legOp = lineOf(leg.line).operator;
    if (legOp !== op) {
      if (op) total += fareFor(op, stops);
      op = legOp;
      stops = 0;
    }
    stops += leg.stops;
  }
  if (op) total += fareFor(op, stops);
  return Math.round(total);
}
