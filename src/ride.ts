import type { Event } from "./filter.ts";

export type Point = { lat: number; lng: number };

export type RideEstimate = {
  roadKm: number;
  minutes: number;
  taxi: [number, number]; // THB
  app: [number, number]; // THB, Grab / LINE MAN
  leaveAt: Date; // to arrive 15 minutes before the event starts
};

// Straight-line distance. Roads in Bangkok are longer than the crow flies, hence ROAD_FACTOR.
function haversineKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const ROAD_FACTOR = 1.35;
const AVG_KMH = 20; // Bangkok daytime traffic, roughly
const PICKUP_MIN = 5;
const ARRIVE_EARLY_MIN = 15;

// Bangkok taxi meter, per-km rate by distance band (flag fall covers the first km).
// Approximate public rates — check the current Department of Land Transport schedule before relying on them.
const FLAG_FALL = 35;
const BANDS: [upToKm: number, perKm: number][] = [
  [10, 6.5],
  [20, 7],
  [40, 8],
  [60, 8.5],
  [80, 9],
  [Infinity, 10.5],
];

function meterFare(km: number): number {
  let fare = FLAG_FALL;
  let from = 1;
  for (const [upTo, rate] of BANDS) {
    if (km <= from) break;
    fare += (Math.min(km, upTo) - from) * rate;
    from = upTo;
  }
  return fare;
}

const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

export function estimateRide(from: Point, e: Event): RideEstimate {
  const roadKm = haversineKm(from, { lat: e.venue.lat, lng: e.venue.lng }) * ROAD_FACTOR;
  const minutes = Math.ceil((roadKm / AVG_KMH) * 60 + PICKUP_MIN);
  const meter = meterFare(roadKm);
  return {
    roadKm,
    minutes,
    // Meter plus time stuck in traffic; app rides usually cost more than the meter and surge at busy times.
    taxi: [round10(meter), round10(meter * 1.3)],
    app: [round10(meter * 1.2), round10(meter * 1.8)],
    leaveAt: new Date(Date.parse(e.start_datetime) - (minutes + ARRIVE_EARLY_MIN) * 60 * 1000),
  };
}

export const GRAB_URL = "https://www.grab.com/th/transport/";
export const LINEMAN_URL = "https://lineman.line.me/";
export const directionsUrl = (from: Point, e: Event) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${e.venue.lat},${e.venue.lng}&travelmode=driving`;
