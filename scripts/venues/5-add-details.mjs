// Fills in everything OpenStreetMap knows about each venue in scoop-venues-bkk.json, and sorts venues into:
//   venue_type  "business" (a shop, restaurant, bar, gym, studio, cinema ...) or "public" (park, market, museum,
//               public pitch ...). Events at a business need booking; at a public place only programmes do.
//   activity    for sports venues: what you go there for (tennis, yoga, climbing, ...).
//   details     opening hours, address, website, email, social links, wheelchair access, cuisine, sports, fee,
//               description and Wikipedia, when OpenStreetMap has them.
// Safe to re-run: it rebuilds these fields from the downloaded tags.
//   node scripts/venues/5-add-details.mjs <dir>      (<dir> caches the OpenStreetMap downloads)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
const file = new URL("../../scoop-venues-bkk.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));

const EPS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tagsFor(chunk, i) {
  const out = `${dir}/osm-details-${i}-${chunk.length}.json`;
  if (existsSync(out) && readFileSync(out, "utf8").startsWith("{")) return JSON.parse(readFileSync(out, "utf8")).elements;
  const q = `[out:json][timeout:120];(${chunk.map(([type, id]) => `${type}(${id});`).join("")});out tags;`;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await fetch(EPS[attempt % EPS.length], { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(150000) });
      const text = await res.text();
      if (text.startsWith("{")) { writeFileSync(out, text); return JSON.parse(text).elements; }
    } catch {}
    await sleep(4000);
  }
  throw new Error(`Overpass failed for chunk ${i}`);
}

const refs = data.venues.map((v) => v.source.url.split("/").slice(-2)).map(([type, id]) => [type, Number(id)]);
const tags = new Map();
for (let i = 0; i < refs.length; i += 150) {
  for (const e of await tagsFor(refs.slice(i, i + 150), i)) tags.set(`${e.type}/${e.id}`, e.tags ?? {});
  console.log(`downloaded tags ${Math.min(i + 150, refs.length)}/${refs.length}`);
}

const list = (s) => (s ? s.split(";").map((x) => x.trim().replace(/_/g, " ")).filter(Boolean) : undefined);
const url = (s) => (!s ? undefined : /^https?:\/\//.test(s) ? s : `https://${s.replace(/^\/+/, "")}`);
const social = (s, site) => (!s ? undefined : /^https?:\/\//.test(s) ? s : `https://www.${site}.com/${s.replace(/^@/, "")}`);

// What a sports venue is for, from its sport tag first, then its name.
const ACTIVITY_BY_SPORT = { tennis: "tennis", badminton: "badminton", swimming: "swimming", climbing: "climbing", soccer: "football", futsal: "football", golf: "golf", skateboard: "skate", muay_thai: "muay_thai", boxing: "muay_thai", kickboxing: "muay_thai", yoga: "yoga", fitness: "fitness", crossfit: "fitness", padel: "padel", running: "running", athletics: "running", basketball: "basketball", table_tennis: "table_tennis", "10pin": "bowling", archery: "archery", wakeboarding: "wakeboard", surfing: "surfing" };
// Names that say exactly what a place is win over its sport tag (a pilates studio tagged "yoga", an ice rink tagged
// "fitness"); then the sport tag; then looser name hints.
const ACTIVITY_FIRST = [
  [/wake|เวค/i, "wakeboard"], [/surf|flow ?house/i, "surfing"], [/climb|boulder|rock domain/i, "climbing"], [/padel/i, "padel"], [/trampoline|jump/i, "trampoline"],
  [/ice|sub-?zero|skating/i, "ice_skating"], [/kart/i, "karting"], [/racquet|squash/i, "racquet"], [/bowl/i, "bowling"], [/pilates|lates\b/i, "pilates"],
];
const ACTIVITY_BY_NAME = [
  [/yoga|โยคะ/i, "yoga"], [/muay|boxing|fight|มวย|kickbox/i, "muay_thai"], [/tennis|เทนนิส/i, "tennis"], [/badminton|แบด/i, "badminton"],
  [/swim|ว่ายน้ำ|pool|water world/i, "swimming"], [/golf|กอล์ฟ|driving range|ไดร์ฟ/i, "golf"], [/skate/i, "skate"], [/football|soccer|futsal|ฟุตบอล/i, "football"],
  [/archery|ยิงธนู/i, "archery"], [/run|วิ่ง|skywalk/i, "running"], [/dance|เต้น|moves/i, "dance"],
  [/crossfit|gym|fitness|ฟิตเนส|bootcamp|studio|training|flex|fit\b|jetts|iron hive/i, "fitness"], [/park|สวน|ลานกีฬา|stadium|สนามกีฬา|arena|sport/i, "sports_ground"],
];
function activityOf(v, t) {
  const name = `${v.name_en} ${v.name_th}`;
  const first = ACTIVITY_FIRST.find(([re]) => re.test(name));
  if (first) return first[1];
  for (const s of list(t.sport) ?? []) if (ACTIVITY_BY_SPORT[s.replace(/ /g, "_")]) return ACTIVITY_BY_SPORT[s.replace(/ /g, "_")];
  return ACTIVITY_BY_NAME.find(([re]) => re.test(name))?.[1] ?? "sports_ground";
}

// Business or public place. Food, drink, entertainment and workshops are businesses; markets and museums are public.
// Sports depends on the place: gyms, studios, clubs, shops, ticketed stadiums and courts you rent are businesses;
// parks, public pitches, skateparks and free-entry stadiums are public.
function venueTypeOf(v, t) {
  if (["food", "nightlife", "music", "film", "comedy", "workshop"].includes(v.category)) return "business";
  if (v.category === "market" || v.category === "art") return "public";
  const name = `${v.name_en} ${v.name_th}`;
  if (t.shop) return "business";
  if (/skate ?park|public|ชุมชน|community|ลานกีฬา|สวนสุขภาพ|youth|channel 7|forest park|benja?kitti park|benchasiri/i.test(name) || t.leisure === "park" || t.fee === "no") return "public";
  if (/club|คลับ|สโมสร|academy|gym|fitness|studio|centre|center|arena|range|wake|lab|camp|playground|pilates|lates\b|jetts|iron hive|moves|kart|racquet|boxing stadium|court|pool|สระ|สนามแบด|field|trampoline|jump|climb|boulder|bowl|surf|flow ?house|padel|ice|skating/i.test(name)) return "business";
  if (/stadium|สนามกีฬา|park/i.test(name)) return "public";
  return ["running", "skate", "sports_ground"].includes(v.activity) ? "public" : "business";
}

let filled = 0;
for (const v of data.venues) {
  const t = tags.get(v.source.url.split("/").slice(-2).join("/")) ?? {};
  // Venues added by 4-add-sports.mjs already know their activity; the rest are worked out here.
  if (v.category === "sports") v.activity = v.source.added_as_activity ?? activityOf(v, t);
  v.venue_type = venueTypeOf(v, t);
  const address = [t["addr:housenumber"], t["addr:street"], t["addr:subdistrict"] ?? t["addr:suburb"], t["addr:district"], t["addr:postcode"]].filter(Boolean).join(", ") || undefined;
  const details = {
    opening_hours: t.opening_hours,
    address: v.address ?? address,
    floor: t["addr:floor"] ?? t.level,
    website: url(t.website ?? t["contact:website"] ?? t.url),
    email: t.email ?? t["contact:email"],
    facebook: social(t["contact:facebook"] ?? t.facebook, "facebook"),
    instagram: social(t["contact:instagram"] ?? t.instagram, "instagram"),
    line: t["contact:line"],
    wheelchair: t.wheelchair,
    cuisine: list(t.cuisine),
    sports: list(t.sport),
    vegetarian: t["diet:vegetarian"],
    vegan: t["diet:vegan"],
    outdoor_seating: t.outdoor_seating,
    air_conditioning: t.air_conditioning,
    fee: t.fee,
    description: t["description:en"] ?? t.description,
    description_th: t["description:th"],
    wikipedia: t.wikipedia ? `https://${t.wikipedia.split(":")[0]}.wikipedia.org/wiki/${encodeURIComponent(t.wikipedia.split(":").slice(1).join(":").replace(/ /g, "_"))}` : undefined,
    brand: t.brand,
    osm_kind: t.amenity ?? t.leisure ?? t.tourism ?? t.shop ?? t.craft,
  };
  v.details = Object.fromEntries(Object.entries(details).filter(([, x]) => x !== undefined && x !== null && !(Array.isArray(x) && !x.length)));
  v.opening_hours ??= v.details.opening_hours ?? null;
  v.website ??= v.details.website ?? null;
  v.address ??= v.details.address ?? null;
  if (Object.keys(v.details).length > 1) filled++;
}

writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
const count = (k) => data.venues.filter((v) => v.details[k] !== undefined).length;
const by = (key) => data.venues.reduce((a, v) => ((a[v[key]] = (a[v[key]] ?? 0) + 1), a), {});
console.log(`venues: ${data.venues.length} · with details beyond the kind of place: ${filled}`);
console.log("has:", Object.fromEntries(["opening_hours", "address", "website", "email", "facebook", "instagram", "wheelchair", "cuisine", "sports", "fee", "description", "wikipedia"].map((k) => [k, count(k)])));
console.log("venue_type:", by("venue_type"));
console.log("activity:", data.venues.filter((v) => v.category === "sports").reduce((a, v) => ((a[v.activity] = (a[v.activity] ?? 0) + 1), a), {}));
