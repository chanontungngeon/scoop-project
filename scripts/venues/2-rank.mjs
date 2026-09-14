import { readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2];
const stations = JSON.parse(readFileSync(`${dir}/stations-clean.json`, "utf8"));
const rad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
const thai = (s) => /[ก-๙]/.test(s ?? "");
const latin = (s) => /[a-z]/i.test(s ?? "") && !thai(s);

const load = (cat) => JSON.parse(readFileSync(`${dir}/osm-${cat}.json`, "utf8")).elements;
const nameOf = (e) => `${e.tags["name:en"] ?? ""} ${e.tags.name ?? ""}`;
const without = (re) => (e) => !re.test(nameOf(e));
const pools = {
  art: load("art").filter(without(/bank|health|air force|library|police|army|navy|forensic|wat |วัด|parasit|anatom|medical|stamp|coin/i)),
  workshop: [...load("workshop"), ...load("workshop2")]
    .filter((e) => e.tags.amenity === "cooking_school" || /pottery|ceramic|workshop|cooking|culinary|craft|atelier|candle|perfume|leather|class|studio|ปั้น|เซรามิก|ทำอาหาร|คราฟ/i.test(nameOf(e)) || /pottery|ceramic|handicraft|jewel|leather|candle|glass/.test(e.tags.craft ?? ""))
    .filter(without(/production|film|co\.|ltd|company|บริษัท|violin|piano|tutor|supply|supplies|wholesale|hardware|craft beer|craftbeer|brew|dispensary|cannabis|barber|yankee|makkasan|body touch|silver|aircraft|accessories|^\s*workshop\s*$/i)),
  food: load("food"),
  music: [...load("music"), ...load("nightlife").filter((e) => e.tags.live_music === "yes" || /jazz|blues|\blive\b|music|rock|acoustic|saxophone|brown sugar/i.test(e.tags["name:en"] ?? e.tags.name ?? ""))],
  market: load("market"),
  comedy: load("comedy").filter(without(/snake|venom|library|hall$|อัฒจันทร์|ลานหิน|หอประชุม|school|university/i)),
  film: load("film").filter((e) => (e.tags["name:en"] ?? e.tags.name ?? "").trim().length > 8),
  nightlife: load("nightlife").filter((e) => /bar|pub|club|lounge|beer|cocktail|rooftop|sky|brew|บาร์|ผับ/i.test(nameOf(e)) || e.tags.amenity === "nightclub").filter(without(/shop|event space|hotel lobby/i)),
  sports: load("sports").filter(without(/\bspa\b|school|university|condo|residence|hotel/i)),
};

const out = [];
const counts = {};
for (const [cat, els] of Object.entries(pools)) {
  const seen = new Set();
  const ranked = els.flatMap((e) => {
    const t = e.tags;
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (lat == null) return [];
    const en = t["name:en"] ?? (latin(t.name) ? t.name : null);
    const th = t["name:th"] ?? (thai(t.name) ? t.name : null);
    if (!en && !th) return [];
    let best = null;
    for (const s of stations) { const d = distM({ lat, lng }, s); if (!best || d < best.d) best = { s, d }; }
    if (best.d > (cat === "workshop" || cat === "music" || cat === "comedy" ? 1500 : 1000)) return [];
    const phones = (t.phone ?? t["contact:phone"] ?? "").split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    const phone = phones[0] ?? null;
    const website = t.website ?? t["contact:website"] ?? null;
    const kindBonus = (cat === "art" && (t.tourism === "gallery" || t.amenity === "arts_centre") ? 3 : 0) + (cat === "comedy" && /comedy/i.test(nameOf(e)) ? 5 : 0);
    const score = kindBonus + (phone ? 3 : 0) + (website ? 2 : 0) + (t.wikidata ? 2 : 0) + (en && th ? 2 : 0) + (t.opening_hours ? 1 : 0) - best.d / 400;
    return [{ e, t, lat, lng, en, th, phone, phones, website, best, score }];
  }).sort((a, b) => b.score - a.score).filter((v) => { const k = (v.en ?? v.th).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  counts[cat] = ranked.length;
  ranked.slice(0, 12).forEach((v, i) => {
    const { s, d } = v.best;
    const walk = Math.max(1, Math.ceil((d * 1.3) / 75));
    const addr = [v.t["addr:housenumber"], v.t["addr:street"], v.t["addr:subdistrict"] ?? v.t["addr:suburb"], v.t["addr:district"]].filter(Boolean).join(", ") || null;
    out.push({
      id: `v-${cat}-${String(i + 1).padStart(2, "0")}`,
      category: cat,
      name_en: v.en ?? v.th,
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
      transit_th: `${s.system === "ARL" ? "แอร์พอร์ต เรล ลิงก์" : s.line.replace("Blue", "สายสีน้ำเงิน").replace("Purple", "สายสีม่วง").replace("Yellow", "สายสีเหลือง").replace("Pink", "สายสีชมพู").replace("Gold Line", "สายสีทอง")} ${s.name_th} (${s.ref}) · เดิน ${walk} นาที`,
      source: { name: "OpenStreetMap", license: "ODbL", url: `https://www.openstreetmap.org/${v.e.type}/${v.e.id}`, wikidata: v.t.wikidata ?? null },
    });
  });
}
writeFileSync(`${dir}/venues.json`, JSON.stringify(out, null, 2));
console.log("candidates within 1 km of a station:", counts);
const by = {}; out.forEach((v) => (by[v.category] = (by[v.category] ?? 0) + 1));
console.log("selected:", by, "total", out.length, "| with phone:", out.filter((v) => v.phone).length, "| with website:", out.filter((v) => v.website).length);
for (const cat of Object.keys(pools)) console.log(`\n${cat}:\n` + out.filter((v) => v.category === cat).map((v) => `  ${v.name_en} | ${v.name_th} | ${v.transit_en} | ${v.phone ?? "-"}`).join("\n"));
