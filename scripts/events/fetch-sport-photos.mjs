// Downloads up to two openly licensed photos per sports activity from Wikimedia Commons into assets/events/, resized to
// 640 px, and records author and licence in assets/events/sport-photos.json for generate-more.ts.
//   node scripts/events/fetch-sport-photos.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEARCH = {
  tennis: "tennis match court", wakeboard: "cable wakeboarding", climbing: "bouldering gym", padel: "padel tennis",
  badminton: "badminton doubles", swimming: "swimming pool lanes", golf: "golf driving range", skate: "skatepark skateboarding",
  bowling: "bowling lanes pins bowler", ice_skating: "indoor ice skating rink", surfing: "flowrider surfing", trampoline: "trampoline park",
  archery: "archery target range", football: "futsal match", karting: "go-kart track", pilates: "pilates reformer",
  basketball: "basketball players game", dance: "dance class studio", racquet: "squash court",
  yoga: "yoga class studio", muay_thai: "muay thai training", fitness: "group fitness class gym", sports_ground: "athletics running track",
};
const UA = "ScoopClassProject/1.0 (student project; image credits kept)";
const OK_LICENCE = /^(cc[- ]by(-sa)?[- ]?\d|cc0|public domain|pd)/i;
const out = new URL("../../assets/events/", import.meta.url);
const creditsFile = new URL("sport-photos.json", out);
const credits = existsSync(creditsFile) ? JSON.parse(readFileSync(creditsFile, "utf8")) : {};
// Checked by eye after downloading: not the activity, a diagram, or a very old photo. Skipped on re-runs.
const REJECT = /Badminton-Doubles-Hitting-Zones|Eggs_in_basket|Edible_fungi|19190100_Duckpin|Victoria_Rink_Montreal|Joss_Bay|Raisin%27_Cane|Ten_pin_bowling_alley,_Glenrothes|Zone_Bowling_Moorabbin|Recoil_Trampoline_Park|Scioto_Grove_-_Archery_Range_1\.|Kub%C3%ADn|Double-Partner-Dancing|Olympia_2012_Mens_Doubles|0401Boys_of_the_Philippines|50ft_target_at_Archery|Building_Dance_Studios|SABDA_Studio|Muay_thai_clinch/;
const strip = (html) => (html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

for (const [activity, query] of Object.entries(SEARCH)) {
  if (credits[activity]?.length >= 1 && !credits[activity].some((c) => REJECT.test(c.image_source))) { console.log(activity, "cached"); continue; }
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=960`;
  let body;
  for (let attempt = 0; attempt < 6; attempt++) {
    const text = await (await fetch(api, { headers: { "User-Agent": UA } })).text();
    if (text.startsWith("{")) { body = JSON.parse(text); break; }
    await new Promise((r) => setTimeout(r, 15000)); // "too many requests": wait and retry
  }
  const pages = Object.values(body?.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const picked = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const licence = strip(meta.LicenseShortName?.value);
    if (!info || !OK_LICENCE.test(licence) || info.width < 800 || info.width < info.height) continue;
    if (/logo|map|diagram|icon|svg|stamp|poster|\.png$/i.test(p.title) || REJECT.test(info.descriptionurl)) continue;
    const n = picked.length + 1;
    const path = `assets/events/sport-${activity}-${n}.jpg`;
    const tmp = new URL(`sport-${activity}-${n}.orig`, out);
    const img = await fetch(info.thumburl, { headers: { "User-Agent": UA } });
    if (!img.ok) continue;
    writeFileSync(tmp, Buffer.from(await img.arrayBuffer()));
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", "640", fileURLToPath(tmp), "--out", fileURLToPath(new URL(`sport-${activity}-${n}.jpg`, out))], { stdio: "ignore" });
    unlinkSync(tmp);
    picked.push({
      image_path: path,
      image_url: info.thumburl,
      image_credit: `Photo: ${strip(meta.Artist?.value) || "Unknown author"} · ${licence} · Wikimedia Commons`,
      image_source: info.descriptionurl,
    });
    if (picked.length === 2) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  credits[activity] = picked;
  writeFileSync(creditsFile, JSON.stringify(credits, null, 2) + "\n");
  console.log(activity.padEnd(14), picked.length, picked.map((x) => x.image_source.split("File:")[1]).join(" | "));
  await new Promise((r) => setTimeout(r, 3000));
}
