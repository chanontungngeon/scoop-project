// Adds more real venues to scoop-venues-bkk.json without touching the ones already there (events link to their ids).
// Uses the same filters and scoring as 2-rank.mjs, and the stations already in scoop-venues-bkk.json.
//   node scripts/venues/1-fetch-osm.mjs <dir>
//   node scripts/venues/3-add-venues.mjs <dir> [--dry]
import { readFileSync, writeFileSync } from "node:fs";

const dir = process.argv[2];
const dry = process.argv.includes("--dry");
const file = new URL("../../scoop-venues-bkk.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const stations = data.stations;

// How many venues each category should have in the end (fewer if OpenStreetMap doesn't have enough good ones).
const TARGET = { art: 110, workshop: 40, food: 130, music: 30, market: 95, comedy: 22, film: 30, nightlife: 58, sports: 110 };

const rad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
const thai = (s) => /[ก-๙]/.test(s ?? "");
const latin = (s) => /[a-z]/i.test(s ?? "") && !thai(s);

const load = (cat) => JSON.parse(readFileSync(`${dir}/osm-${cat}.json`, "utf8")).elements;
const nameOf = (e) => `${e.tags["name:en"] ?? ""} ${e.tags.name ?? ""}`;
const without = (re) => (e) => !re.test(nameOf(e));
const pools = {
  art: load("art").filter(without(/bank|health|air force|library|police|army|navy|forensic|wat |วัด|parasit|anatom|medical|stamp|coin/i)),
  workshop: load("workshop")
    .filter((e) => e.tags.amenity === "cooking_school" || /pottery|ceramic|workshop|cooking|culinary|craft|atelier|candle|perfume|leather|class|studio|ปั้น|เซรามิก|ทำอาหาร|คราฟ/i.test(nameOf(e)) || /pottery|ceramic|handicraft|jewel|leather|candle|glass/.test(e.tags.craft ?? ""))
    .filter(without(/production|film|co\.|ltd|company|บริษัท|violin|piano|tutor|supply|supplies|wholesale|hardware|craft beer|craftbeer|brew|dispensary|cannabis|barber|yankee|makkasan|body touch|silver|aircraft|accessories|^\s*workshop\s*$/i)),
  food: load("food"),
  music: [...load("music"), ...load("nightlife").filter((e) => e.tags.live_music === "yes" || /jazz|blues|\blive\b|music|rock|acoustic|saxophone|brown sugar/i.test(e.tags["name:en"] ?? e.tags.name ?? ""))],
  market: load("market"),
  comedy: load("comedy").filter(without(/snake|venom|library|hall$|อัฒจันทร์|ลานหิน|หอประชุม|school|university/i)),
  film: load("film").filter((e) => (e.tags["name:en"] ?? e.tags.name ?? "").trim().length > 8),
  nightlife: load("nightlife").filter((e) => /bar|pub|club|lounge|beer|cocktail|rooftop|sky|brew|บาร์|ผับ/i.test(nameOf(e)) || e.tags.amenity === "nightclub").filter(without(/shop|event space|hotel lobby|cannabis|dispensary|weed|massage|gentlemen|go-?go|a-go-go|agogo|pussy|nana plaza|soapy|\bsex\b|girls/i)),
  sports: load("sports").filter(without(/\bspa\b|school|university|condo|residence|hotel/i)),
};

// Checked by hand after a dry run: adult bars, shops that aren't workshops (gem and jewellery shops near Khao San are a
// known tourist scam), and places too generic or odd to host an event.
const EXCLUDE = new RegExp([
  // nightlife
  "hillary", "cockatoo", "emmanuelle", "baccarat", "swanclub", "kazy kozi", "healthy bar", "la belle", "tawan", "king indian", "badshah",
  "q&a bar", "sukanya", "twilight man", "pegasus", "scratch dog", "karaoke", "cheers-like", "^beer bar$", "midnight bar", "^bk bar$", "party house", "mansion 7", "^glow$", "cactus club", "izumo", "^beer garden$",
  // workshop, art
  "jewel", "chaotic trading", "body art", "เพชรมณี", "erotic", "pharmacy",
  // market, sports, comedy, film
  "telephone parts", "living animals", "^market$", "lottery", "^columbia$", "^west one$", "yanhee hospital", "^food market$", "^ตลาด$", "เก้าอี้ไม้", "ศูนย์การค้า", "^street food and fruits$",
  "golf simulator", "^สระว่ายน้ำ$", "public free sport", "california wow", "^dinner theater$", "5th floor",
].join("|"), "i");

const known = new Set(data.venues.flatMap((v) => [v.source?.url, v.name_en?.toLowerCase(), v.name_th?.toLowerCase()].filter(Boolean)));
const lineTh = (s) => s.line.replace("Blue", "สายสีน้ำเงิน").replace("Purple", "สายสีม่วง").replace("Yellow", "สายสีเหลือง").replace("Pink", "สายสีชมพู").replace("Gold Line", "สายสีทอง");

const added = [];
for (const [cat, els] of Object.entries(pools)) {
  const have = data.venues.filter((v) => v.category === cat);
  const nextNum = Math.max(0, ...have.map((v) => Number(v.id.split("-").pop()) || 0)) + 1;
  const seen = new Set();
  const ranked = els.flatMap((e) => {
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (lat == null) return [];
    const en = t["name:en"] ?? (latin(t.name) ? t.name : null);
    const th = t["name:th"] ?? (thai(t.name) ? t.name : null);
    if (!en && !th) return [];
    if (EXCLUDE.test(en ?? "") || EXCLUDE.test(th ?? "")) return [];
    const url = `https://www.openstreetmap.org/${e.type}/${e.id}`;
    if (known.has(url) || known.has(en?.toLowerCase()) || known.has(th?.toLowerCase())) return [];
    let best = null;
    for (const s of stations) { const d = distM({ lat, lng }, s); if (!best || d < best.d) best = { s, d }; }
    if (best.d > (cat === "workshop" || cat === "music" || cat === "comedy" ? 1500 : 1000)) return [];
    const phones = (t.phone ?? t["contact:phone"] ?? "").split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    const phone = phones[0] ?? null;
    const website = t.website ?? t["contact:website"] ?? null;
    const kindBonus = (cat === "art" && (t.tourism === "gallery" || t.amenity === "arts_centre") ? 3 : 0) + (cat === "comedy" && /comedy/i.test(nameOf(e)) ? 5 : 0);
    const score = kindBonus + (phone ? 3 : 0) + (website ? 2 : 0) + (t.wikidata ? 2 : 0) + (en && th ? 2 : 0) + (t.opening_hours ? 1 : 0) - best.d / 400;
    return [{ e, t, lat, lng, en, th, phone, phones, website, best, score, url }];
  }).sort((a, b) => b.score - a.score).filter((v) => { const k = (v.en ?? v.th).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

  ranked.slice(0, Math.max(0, TARGET[cat] - have.length)).forEach((v, i) => {
    const { s, d } = v.best;
    const walk = Math.max(1, Math.ceil((d * 1.3) / 75));
    const addr = [v.t["addr:housenumber"], v.t["addr:street"], v.t["addr:subdistrict"] ?? v.t["addr:suburb"], v.t["addr:district"]].filter(Boolean).join(", ") || null;
    const name = v.en ?? v.th;
    added.push({
      id: `v-${cat}-${String(nextNum + i).padStart(2, "0")}`,
      category: cat,
      name_en: name,
      name_th: v.th ?? v.en,
      lat: Number(v.lat.toFixed(6)),
      lng: Number(v.lng.toFixed(6)),
      address: addr,
      phone: v.phone,
      phones_all: v.phones,
      website: v.website,
      opening_hours: v.t.opening_hours ?? null,
      contact_person: null,
      nearest_station: { ref: s.ref, line: s.line, name_en: s.name_en, name_th: s.name_th, distance_m: Math.round(d), walk_min: walk },
      transit_en: `${s.system === "ARL" ? "Airport Rail Link" : s.line} ${s.name_en} (${s.ref}) · ${walk} min walk`,
      transit_th: `${s.system === "ARL" ? "แอร์พอร์ต เรล ลิงก์" : lineTh(s)} ${s.name_th} (${s.ref}) · เดิน ${walk} นาที`,
      source: { name: "OpenStreetMap", license: "ODbL", url: v.url, wikidata: v.t.wikidata ?? null },
      google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${s.name_en}, Bangkok`)}`,
    });
  });
  console.log(`${cat.padEnd(9)} had ${String(have.length).padStart(3)} · candidates ${String(ranked.length).padStart(3)} · adding ${added.filter((v) => v.category === cat).length}`);
}

console.log(`\nadding ${added.length} venues → ${data.venues.length + added.length} total | with phone: ${added.filter((v) => v.phone).length} | with website: ${added.filter((v) => v.website).length}`);
if (dry) {
  for (const v of added) console.log(`  ${v.id.padEnd(15)} ${v.name_en} | ${v.name_th} | ${v.transit_en}`);
} else {
  data.venues.push(...added);
  data.meta.fetched_at = new Date().toISOString().slice(0, 10);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("saved scoop-venues-bkk.json");
}
