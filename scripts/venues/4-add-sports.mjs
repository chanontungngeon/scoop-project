// Adds sports activity venues (tennis, wakeboard, climbing, padel, ...) to scoop-venues-bkk.json. Each gets an
// `activity` so events can match what the place is for. Wakeboard and other water sports are rarely next to a station,
// so those may be further out: their transit line says how long the taxi is from the nearest station.
//   node scripts/venues/4-add-sports.mjs <dir> [--dry]      (<dir> caches the OpenStreetMap downloads)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
const dry = process.argv.includes("--dry");
const file = new URL("../../scoop-venues-bkk.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const stations = data.stations;

const CITY = "(13.65,100.45,13.92,100.70)";
const WIDE = "(13.55,100.30,14.05,100.90)"; // wake parks and golf are out of the centre
// activity: [queries, how far from a station (m), max venues]
const ACTIVITIES = {
  tennis: [[`nwr["sport"~"tennis"]["name"]${CITY};`], 1500, 14],
  wakeboard: [[`nwr["sport"~"wakeboarding|water_ski"]${WIDE};`, `nwr["name"~"[Ww]ake ?[Pp]ark|[Cc]able ?[Ss]ki|เวคบอร์ด"]${WIDE};`], 25000, 6],
  climbing: [[`nwr["sport"~"climbing"]["name"]${CITY};`, `nwr["name"~"[Bb]oulder|[Cc]limbing"]["leisure"]${CITY};`], 8000, 8],
  padel: [[`nwr["sport"~"padel"]["name"]${CITY};`, `nwr["name"~"[Pp]adel"]${CITY};`], 2500, 8],
  badminton: [[`nwr["sport"~"badminton"]["name"]${CITY};`], 1500, 10],
  swimming: [[`nwr["leisure"~"^(sports_centre|swimming_pool|water_park)$"]["sport"~"swimming"]["name"]["access"!~"private|customers"]${CITY};`, `nwr["leisure"="water_park"]["name"]${WIDE};`], 2500, 10],
  golf: [[`nwr["golf"="driving_range"]["name"]${WIDE};`, `nwr["leisure"="golf_course"]["name"]${CITY};`], 6000, 8],
  skate: [[`nwr["leisure"="skatepark"]${CITY};`, `nwr["sport"~"skateboard"]${CITY};`], 2500, 8],
  bowling: [[`nwr["leisure"="bowling_alley"]${CITY};`, `nwr["sport"~"10pin|bowling"]["name"]${CITY};`], 1500, 8],
  ice_skating: [[`nwr["leisure"="ice_rink"]${CITY};`, `nwr["sport"~"ice_skating"]["name"]${CITY};`], 2500, 5],
  surfing: [[`nwr["sport"~"surfing"]${WIDE};`, `nwr["name"~"[Ss]urf|[Ff]low[Rr]ider"]["leisure"]${WIDE};`], 6000, 5],
  paddling: [[`nwr["sport"~"canoe|kayak|paddle|sup"]${WIDE};`, `nwr["name"~"[Kk]ayak|SUP|[Pp]addle"]["leisure"]${WIDE};`], 6000, 6],
  trampoline: [[`nwr["leisure"="trampoline_park"]${CITY};`, `nwr["name"~"[Tt]rampoline|[Jj]ump ?[Pp]ark"]${CITY};`], 2500, 6],
  archery: [[`nwr["sport"~"archery"]["name"]${CITY};`], 3000, 4],
  football: [[`nwr["sport"~"soccer|futsal"]["leisure"~"^(pitch|sports_centre)$"]["name"]${CITY};`], 1200, 10],
  muay_thai: [[], 3000, 2],
};
// Checked by hand after a dry run: not a place you'd go for the activity, or a name that just says what it is.
const EXCLUDE = /school|university|college|โรงเรียน|มหาวิทยาลัย|condo|residence|hotel|คอนโด|หมู่บ้าน|village|embassy|army|police|military|ทหาร|ตำรวจ|private|shop|store|ร้าน|decathlon|โรงหนัง|เทเบิลเทนนิส/i;
const GENERIC = /^(tennis court|badminton court|สนามเทนนิส|สนามแบดมินตัน|คอร์ตแบต|สนามฟุตบอล(ในร่ม)?|สนามกีฬาอเนกประสงค์|สนามกีฬาในร่ม ?\d*|indoor stadium ?\d*|สระว่ายน้ำ( \d+ เมตร)?|โดม|อาคาร \S+|เล่นกีฬา|\S+ course)$/i;
// Found by name with OpenStreetMap's search (Nominatim) because their tags don't match the queries above: [type, id].
const BY_ID = {
  surfing: [["node", 5383650084]], // Flow House Bangkok
  climbing: [["node", 5374585867], ["node", 13988478934], ["node", 9446215117], ["node", 12428810703]], // Rock Domain, Bloc City, Gravity Lab, Eagle Eye
  bowling: [["node", 4620839897]], // Blu Bowling
  trampoline: [["node", 5450951233]], // Rockin' Jump Trampoline Park
  muay_thai: [["node", 4563386392]], // Jitti Gym
};

const EPS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(name, parts) {
  if (!parts.length) return [];
  const out = `${dir}/osm-sport-${name}.json`;
  if (existsSync(out) && readFileSync(out, "utf8").startsWith("{")) return JSON.parse(readFileSync(out, "utf8")).elements;
  const q = `[out:json][timeout:90];(${parts.join("")});out tags center;`;
  for (let attempt = 0; attempt < 12; attempt++) {
    const ep = EPS[attempt % EPS.length];
    try {
      const res = await fetch(ep, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(120000) });
      const text = await res.text();
      if (text.startsWith("{")) { writeFileSync(out, text); return JSON.parse(text).elements; }
    } catch {}
    await sleep(4000);
  }
  throw new Error(`Overpass failed for ${name}`);
}

const rad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
const thai = (s) => /[ก-๙]/.test(s ?? "");
const latin = (s) => /[a-z]/i.test(s ?? "") && !thai(s);
const lineTh = (s) => s.line.replace("Blue", "สายสีน้ำเงิน").replace("Purple", "สายสีม่วง").replace("Yellow", "สายสีเหลือง").replace("Pink", "สายสีชมพู").replace("Gold Line", "สายสีทอง");

const known = new Set(data.venues.flatMap((v) => [v.source?.url, v.name_en?.toLowerCase(), v.name_th?.toLowerCase()].filter(Boolean)));
let next = Math.max(0, ...data.venues.filter((v) => v.category === "sports").map((v) => Number(v.id.split("-").pop()) || 0)) + 1;
const added = [];

for (const [activity, [parts, maxDist, max]] of Object.entries(ACTIVITIES)) {
  const ids = BY_ID[activity] ?? [];
  const pinned = new Set(ids.map(([t, id]) => `https://www.openstreetmap.org/${t}/${id}`));
  const els = [...(await overpass(activity, parts)), ...(await overpass(`${activity}-by-id`, ids.map(([t, id]) => `${t}(${id});`)))];
  const seen = new Set();
  const ranked = els.flatMap((e) => {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (lat == null) return [];
    const en = t["name:en"] ?? (latin(t.name) ? t.name : null);
    const th = t["name:th"] ?? (thai(t.name) ? t.name : null);
    if (!en && !th) return [];
    if (EXCLUDE.test(`${en ?? ""} ${th ?? ""}`) || t.access === "private") return [];
    if (![en, th].some((n) => n && !GENERIC.test(n.trim()))) return [];
    const url = `https://www.openstreetmap.org/${e.type}/${e.id}`;
    if (known.has(url) || known.has(en?.toLowerCase()) || known.has(th?.toLowerCase())) return [];
    let best = null;
    for (const s of stations) { const d = distM({ lat, lng }, s); if (!best || d < best.d) best = { s, d }; }
    if (best.d > maxDist && !pinned.has(url)) return [];
    const phones = (t.phone ?? t["contact:phone"] ?? "").split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    const website = t.website ?? t["contact:website"] ?? null;
    const score = (pinned.has(url) ? 10 : 0) + (phones[0] ? 3 : 0) + (website ? 2 : 0) + (t.wikidata ? 2 : 0) + (en && th ? 2 : 0) + (t.opening_hours ? 1 : 0) - best.d / 1000;
    return [{ e, t, lat, lng, en, th, phones, website, best, score, url }];
  }).sort((a, b) => b.score - a.score).filter((v) => { const k = (v.en ?? v.th).toLowerCase(); if (seen.has(k)) return false; seen.add(k); known.add(k); known.add(v.url); return true; });

  for (const v of ranked.slice(0, max)) {
    const { s, d } = v.best;
    const walk = Math.max(1, Math.ceil((d * 1.3) / 75));
    const taxi = Math.max(5, Math.ceil((d * 1.4) / 400)); // ~24 km/h in Bangkok traffic
    const line = s.system === "ARL" ? "Airport Rail Link" : s.line;
    const lineThai = s.system === "ARL" ? "แอร์พอร์ต เรล ลิงก์" : lineTh(s);
    const name = v.en ?? v.th;
    added.push({
      id: `v-sports-${String(next++).padStart(2, "0")}`,
      category: "sports",
      activity,
      name_en: name,
      name_th: v.th ?? v.en,
      lat: Number(v.lat.toFixed(6)),
      lng: Number(v.lng.toFixed(6)),
      address: [v.t["addr:housenumber"], v.t["addr:street"], v.t["addr:subdistrict"] ?? v.t["addr:suburb"], v.t["addr:district"]].filter(Boolean).join(", ") || null,
      phone: v.phones[0] ?? null,
      phones_all: v.phones,
      website: v.website,
      opening_hours: v.t.opening_hours ?? null,
      contact_person: null,
      nearest_station: { ref: s.ref, line: s.line, name_en: s.name_en, name_th: s.name_th, distance_m: Math.round(d), walk_min: walk },
      transit_en: walk <= 20 ? `${line} ${s.name_en} (${s.ref}) · ${walk} min walk` : `${line} ${s.name_en} (${s.ref}) · then ~${taxi} min by taxi`,
      transit_th: walk <= 20 ? `${lineThai} ${s.name_th} (${s.ref}) · เดิน ${walk} นาที` : `${lineThai} ${s.name_th} (${s.ref}) · ต่อแท็กซี่ ~${taxi} นาที`,
      source: { name: "OpenStreetMap", license: "ODbL", url: v.url, wikidata: v.t.wikidata ?? null, added_as_activity: activity },
      google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Bangkok`)}`,
    });
  }
  console.log(`${activity.padEnd(12)} found ${String(ranked.length).padStart(3)} · adding ${Math.min(max, ranked.length)}`);
}

console.log(`\nadding ${added.length} sports venues → ${data.venues.length + added.length} total`);
if (dry) for (const v of added) console.log(`  ${v.id.padEnd(15)} ${v.activity.padEnd(11)} ${v.name_en} | ${v.name_th} | ${v.transit_en}`);
else {
  data.venues.push(...added);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("saved scoop-venues-bkk.json");
}
