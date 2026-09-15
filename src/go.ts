import type { Event } from "./filter.ts";
import { title, transit, venue } from "./flex.ts";
import { T } from "./i18n.ts";
import type { Lang } from "./i18n.ts";

// Scoop can't sign anyone in to Grab or LINE MAN or book for them. This page opens in the phone's own browser
// (LINE's in-app browser can't hand off to other apps) and launches the ride app, falling back to its store page.
// Neither Grab nor LINE MAN documents a public link that opens ride booking with a destination filled in, so the
// main button copies the venue name as it opens the app; the user pastes it into "Where to?".
// LINE MAN: https://lineman.lmwn.com/app/* is registered to the LINE MAN app (apple-app-site-association and
// assetlinks.json on that domain), and /app/ride is its ride section. Grab: grab://open?screenType=BOOKING is
// unofficial but tested on a phone; we send both parameter spellings seen in the wild.

export type RideApp = "grab" | "lineman";

const STORES = {
  grab: {
    ios: "https://apps.apple.com/th/app/grab-superapp/id647268330",
    android: "https://play.google.com/store/apps/details?id=com.grabtaxi.passenger",
  },
  lineman: {
    ride: "https://lineman.lmwn.com/app/ride", // what lineman.line.me/taxi redirects to
    smartLink: "https://lineman.onelink.me/1N3T/bfd29207", // from lmwn.com/lineman; opens the app or the right store
    android: "https://play.google.com/store/apps/details?id=com.linecorp.linemanth",
  },
};

export const rideAppUrl = (publicBase: string, app: RideApp, e: Event, lang: Lang) =>
  `${publicBase}/go/${app}?id=${e.id}&lang=${lang}&openExternalBrowser=1`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// lineChatUrl: opens Scoop's chat in LINE, since this page lives in the phone's browser, outside LINE.
export function goPage(app: RideApp, e: Event, lang: Lang, lineChatUrl?: string): string {
  const t = T[lang];
  const name = app === "grab" ? "Grab" : "LINE MAN";
  const color = app === "grab" ? "#00b14f" : "#06c755";
  // Just the place name: it's what ride apps' search matches best.
  const destination = venue(e, lang);
  const { lat, lng } = e.venue;
  const q = new URLSearchParams({
    screenType: "BOOKING",
    dropOffLatitude: String(lat), dropOffLongitude: String(lng), dropOffAddress: destination,
    dropoff_latitude: String(lat), dropoff_longitude: String(lng),
  }).toString();
  const links = {
    ios: app === "grab" ? `grab://open?${q}` : STORES.lineman.ride,
    android: app === "grab"
      ? `intent://open?${q}#Intent;scheme=grab;package=com.grabtaxi.passenger;S.browser_fallback_url=${encodeURIComponent(STORES.grab.android)};end`
      : STORES.lineman.ride,
    iosStore: app === "grab" ? STORES.grab.ios : STORES.lineman.smartLink,
    androidStore: STORES[app].android,
  };

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scoop · ${esc(name)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px; font: 15px/1.45 -apple-system, "Sukhumvit Set", "Noto Sans Thai", system-ui, sans-serif; background: #f4f6f8; color: #1f2933; }
  .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 20px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
  h1 { font-size: 20px; margin: 0 0 4px; }
  #hint { margin: 10px 2px 4px; }
  .muted { color: #6b7280; font-size: 13px; }
  .dest { margin: 16px 0; padding: 12px; border-radius: 12px; background: #f4f6f8; }
  .btn { display: block; width: 100%; margin-top: 10px; padding: 13px; border: 0; border-radius: 12px; font: inherit; font-weight: 700; text-align: center; text-decoration: none; color: #1f2933; background: #eef1f4; cursor: pointer; }
  .primary { background: ${color}; color: #fff; }
  #fallback[hidden] { display: none; }
</style>
</head>
<body>
<div class="card">
  <h1>🚕 ${esc(name)}</h1>
  <div class="muted">${esc(title(e, lang))}</div>
  <div class="dest">
    <div class="muted">${esc(t.destinationL)}</div>
    <div id="dest"><b>${esc(destination)}</b></div>
    <div class="muted" style="margin-top:6px">📍 ${esc(e.venue.area)} · ${esc(transit(e, lang))}</div>
  </div>
  <a class="btn primary" id="go" href="${esc(links.ios)}">${esc(t.copyAndOpen(name))}</a>
  <p class="muted" id="hint">${esc(t.pasteHint(name))}</p>
  <button class="btn" id="copy">${esc(t.copyDestination)}</button>
  <a class="btn" id="open" href="#">${esc(t.openApp(name))}</a>
  <div id="fallback" hidden>
    <p class="muted">${esc(t.noApp(name))}</p>
    <a class="btn" href="${esc(links.iosStore)}">App Store</a>
    <a class="btn" href="${esc(links.androidStore)}">Google Play</a>
  </div>
  ${lineChatUrl ? `<a class="btn" style="margin-top:18px" href="${esc(lineChatUrl)}">${esc(t.backToLine)}</a>` : ""}
</div>
<script>
  const android = /Android/i.test(navigator.userAgent);
  const appLink = android ? ${JSON.stringify(links.android)} : ${JSON.stringify(links.ios)};
  const open = () => { location.href = appLink; setTimeout(() => { document.getElementById("fallback").hidden = false; }, 1800); };
  // Phones only hand a link to an app when the user taps it, so the main button is a real link:
  // copy synchronously in the same tap, then let the browser follow it.
  const copy = () => {
    const text = document.getElementById("dest").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    const r = document.createRange(); r.selectNodeContents(document.getElementById("dest"));
    getSelection().removeAllRanges(); getSelection().addRange(r);
    try { document.execCommand("copy"); } catch {}
    getSelection().removeAllRanges();
  };
  const go = document.getElementById("go");
  go.href = appLink;
  go.addEventListener("click", () => { copy(); go.textContent = ${JSON.stringify(t.copied)}; setTimeout(() => { document.getElementById("fallback").hidden = false; }, 1800); });
  document.getElementById("copy").addEventListener("click", (ev) => { copy(); ev.target.textContent = ${JSON.stringify(t.copied)}; });
  document.getElementById("open").addEventListener("click", (ev) => { ev.preventDefault(); open(); });
</script>
</body>
</html>`;
}
