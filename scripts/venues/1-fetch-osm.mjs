import { writeFileSync, existsSync, readFileSync } from "node:fs";
const BBOX = "(13.65,100.45,13.92,100.70)";
const Q = {
  art: [`nwr["tourism"~"^(gallery|museum)$"]${BBOX};`, `nwr["amenity"="arts_centre"]${BBOX};`],
  workshop: [`nwr["shop"="craft"]${BBOX};`, `nwr["craft"~"pottery|ceramic|jewel|leather|candle|glass|textile|handicraft"]${BBOX};`, `nwr["amenity"~"^(cooking_school|workshop|studio)$"]${BBOX};`],
  food: [`nwr["amenity"="food_court"]${BBOX};`, `nwr["amenity"="restaurant"]["wikidata"]${BBOX};`, `nwr["amenity"="restaurant"]["phone"]["name:en"]${BBOX};`],
  music: [`nwr["amenity"~"^(music_venue|concert_hall)$"]${BBOX};`, `nwr["live_music"="yes"]${BBOX};`],
  market: [`nwr["amenity"="marketplace"]${BBOX};`],
  comedy: [`nwr["amenity"="theatre"]${BBOX};`, `nwr["name"~"[Cc]omedy"]${BBOX};`],
  film: [`nwr["amenity"="cinema"]${BBOX};`],
  nightlife: [`nwr["amenity"="nightclub"]${BBOX};`, `nwr["amenity"~"^(bar|pub)$"]["name:en"]${BBOX};`],
  sports: [`nwr["leisure"~"^(sports_centre|fitness_centre|stadium)$"]["name"]${BBOX};`, `nwr["sport"="muay_thai"]${BBOX};`],
};
const EPS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [cat, parts] of Object.entries(Q)) {
  const out = `${process.argv[2]}/osm-${cat}.json`;
  if (existsSync(out) && readFileSync(out, "utf8").startsWith("{")) { console.log(cat, "cached"); continue; }
  const q = `[out:json][timeout:90];(${parts.join("")});out tags center;`;
  let done = false;
  for (let attempt = 0; attempt < 8 && !done; attempt++) {
    const ep = EPS[attempt % EPS.length];
    try {
      const res = await fetch(ep, { method: "POST", body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(120000) });
      const text = await res.text();
      if (text.startsWith("{")) { writeFileSync(out, text); console.log(cat, JSON.parse(text).elements.length, "from", ep); done = true; }
      else { console.log(cat, "busy at", ep); await sleep(4000); }
    } catch (e) { console.log(cat, "error at", ep, e.message); await sleep(4000); }
  }
  if (!done) console.log(cat, "FAILED");
}
