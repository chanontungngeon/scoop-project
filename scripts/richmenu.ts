// Registers the fixed bottom menu with LINE and makes it every user's default.
// Re-render the image first if you change it:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
//     --force-device-scale-factor=1 --window-size=2500,1686 --screenshot=scripts/richmenu.png scripts/richmenu.html
// Then: npm run richmenu
import "dotenv/config";
import { readFileSync } from "node:fs";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
const NAME = "Scoop menu";
const auth = { Authorization: `Bearer ${TOKEN}` };

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...auth, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// 2500 x 1686, three columns by two rows — must match scripts/richmenu.html.
const cols = [0, 833, 1667];
const widths = [833, 834, 833];
const tiles = ["action=find", "action=bookings", "action=ridemenu", "action=calendar", "action=profile", "action=langs"];
const areas = tiles.map((data, i) => ({
  bounds: { x: cols[i % 3], y: i < 3 ? 0 : 843, width: widths[i % 3], height: 843 },
  action: { type: "postback", data },
}));

const { richmenus } = (await call("https://api.line.me/v2/bot/richmenu/list")) as { richmenus: { richMenuId: string; name: string }[] };
for (const m of richmenus.filter((m) => m.name === NAME)) {
  await call(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE" });
  console.log(`Deleted old menu ${m.richMenuId}`);
}

const { richMenuId } = (await call("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ size: { width: 2500, height: 1686 }, selected: true, name: NAME, chatBarText: "Menu · เมนู", areas }),
})) as { richMenuId: string };

await call(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: { "Content-Type": "image/png" },
  body: readFileSync(new URL("richmenu.png", import.meta.url)),
});
await call(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
console.log(`Rich menu ${richMenuId} is now the default for all users.`);
