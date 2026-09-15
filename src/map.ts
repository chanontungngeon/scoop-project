import type { Event } from "./filter.ts";
import { CATEGORY_STYLE, price, title, venue, when, youtubeUrl } from "./flex.ts";
import { T } from "./i18n.ts";
import type { Lang } from "./i18n.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// One page, opened from the chat inside LINE's in-app browser: every result as a pin on a map.
export function mapPage(events: Event[], lang: Lang): string {
  const t = T[lang];
  const pins = events.map((e) => {
    const s = CATEGORY_STYLE[e.category] ?? { emoji: "📌", color: "#06C755" };
    return { id: e.id, lat: e.venue.lat, lng: e.venue.lng, emoji: s.emoji, color: s.color, title: title(e, lang), price: price(e, lang) };
  });

  const cards = events
    .map((e, i) => {
      const p = pins[i];
      return `<div class="card" role="button" tabindex="0">
  <span class="dot" style="background:${p.color}">${p.emoji}</span>
  <span class="info"><b>${esc(p.title)}</b><small>${esc(when(e, lang))} · ${esc(p.price)}</small><small>📍 ${esc(venue(e, lang))}</small></span>
  <span class="acts">
    <a class="go yt" href="${esc(youtubeUrl(e, lang))}" target="_blank" rel="noopener">${esc(t.watchReview)}</a>
    <a class="go" href="https://www.google.com/maps/dir/?api=1&destination=${e.venue.lat},${e.venue.lng}" target="_blank" rel="noopener">${esc(t.directions)}</a>
  </span>
</div>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scoop · ${esc(t.map)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.4 -apple-system, "Sukhumvit Set", "Noto Sans Thai", system-ui, sans-serif; background: #f4f6f8; color: #1f2933; }
  header { padding: 14px 16px; display: flex; align-items: center; gap: 10px; background: #fff; border-bottom: 1px solid #e5e7eb; }
  header .logo { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #eaf8ef; }
  header small { color: #6b7280; display: block; }
  #map { height: 52vh; background: #e9eef2; }
  .leaflet-control-attribution { background: rgba(255,255,255,.85) !important; color: #6b7280; }
  .leaflet-control-attribution a { color: #07873d; }
  .list { padding: 12px 16px 24px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .card { display: flex; width: 100%; min-width: 0; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(16,24,40,.06); cursor: pointer; }
  .card.active { border-color: #06c755; box-shadow: 0 0 0 2px #eaf8ef; }
  .dot { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(16,24,40,.15); }
  .info { flex: 1; min-width: 0; display: grid; }
  .info small { color: #6b7280; }
  .info b, .info small { overflow-wrap: anywhere; }
  .acts { flex: none; display: grid; gap: 6px; }
  .yt { background: #fdecec !important; color: #c4302b !important; }
  .go { flex: none; padding: 6px 12px; border-radius: 12px; background: #06c755; color: #fff; font-weight: 700; text-decoration: none; font-size: 13px; text-align: center; }
  .pin { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 17px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(16,24,40,.3); }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #fff; color: #1f2933; }
</style>
</head>
<body>
<header><div class="logo">🔍</div><div><b>Scoop</b><small>${esc(t.mapHeader(events.length))}</small></div></header>
<div id="map"></div>
<div class="list">
${cards}
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script>
  const pins = ${JSON.stringify(pins).replace(/</g, "\\u003c")};
  const map = L.map("map", { zoomControl: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
  const cards = document.querySelectorAll(".card");
  const markers = pins.map((p, i) => {
    const icon = L.divIcon({ className: "", html: '<div class="pin" style="background:' + p.color + '">' + p.emoji + "</div>", iconSize: [34, 34], iconAnchor: [17, 17] });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
    const label = document.createElement("div");
    label.innerHTML = "<b></b><br><span></span>";
    label.querySelector("b").textContent = p.title;
    label.querySelector("span").textContent = p.price;
    m.bindPopup(label);
    m.on("click", () => select(i, false));
    return m;
  });
  function select(i, fly) {
    cards.forEach((c, j) => c.classList.toggle("active", i === j));
    if (fly) { map.flyTo([pins[i].lat, pins[i].lng], 15); markers[i].openPopup(); }
  }
  cards.forEach((c, i) => c.addEventListener("click", (ev) => { if (!ev.target.closest(".go")) select(i, true); }));
  map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 14 });
</script>
</body>
</html>`;
}
