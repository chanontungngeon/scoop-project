import type { Event } from "./filter.ts";
import { CHOOSE_LANGUAGE, GREETING, LANGS, M, T, localeOf } from "./i18n.ts";
import type { Lang } from "./i18n.ts";
import { GRAB_URL, LINEMAN_URL, directionsUrl } from "./ride.ts";
import { rideAppUrl } from "./go.ts";
import type { Point, RideEstimate } from "./ride.ts";
import type { TransitPlan } from "./rail.ts";
import type { Match, Reason } from "./match.ts";

export type { Lang };

const TZ = "Asia/Bangkok";
// Light, LINE-like look: white cards, dark text, LINE green for the main action.
export const GREEN = "#06C755"; // buttons and badges with white text
export const GREEN_TEXT = "#07873D"; // green text on white; GREEN itself is too light to read at small sizes
export const CARD = "#FFFFFF";
export const SOFT = "#F4F6F8"; // soft panels and tiles on a white card
export const SOFT_GREEN = "#EAF8EF"; // gentle highlight: map card, "not quite" card, soft green tiles
export const TEXT = "#1F2933";
export const MUTED = "#6B7280";
export const SUBTLE = "#EEF1F4"; // secondary buttons: use with style "secondary" so the label is dark
export const LINE_SEP = "#E5E7EB";
export const WARM = "#B45309"; // amber text for guide lines and hints

// Event photos: the local copy in assets/ once the public (tunnel) URL is known, else the remote original.
// Wikimedia refuses requests without a User-Agent, so the local copy is the safer one for LINE to fetch.
let imageBase: string | undefined;
export const setImageBase = (base: string | undefined) => { if (base) imageBase = base; };
export const imageUrl = (e: Event) => (imageBase && e.image_path ? `${imageBase}/${e.image_path}` : e.image_url);

// ---------- vibes (from the Figma prototype) ----------

export type VibeId = "creative" | "explorer" | "social" | "chiller";

export const VIBES: Record<VibeId, { emoji: string; name: Record<Lang, string>; categories: string[] }> = {
  creative: { emoji: "🎨", name: { th: "สายครีเอทีฟ", en: "Creative", zh: "创意派", hi: "क्रिएटिव" }, categories: ["art", "workshop"] },
  explorer: { emoji: "🗺️", name: { th: "สายสำรวจ", en: "Explorer", zh: "探索派", hi: "एक्सप्लोरर" }, categories: ["food", "market", "sports"] },
  social: { emoji: "🎉", name: { th: "สายปาร์ตี้", en: "Social", zh: "社交派", hi: "सोशल" }, categories: ["nightlife", "comedy", "music"] },
  chiller: { emoji: "☕", name: { th: "สายชิล", en: "Chiller", zh: "休闲派", hi: "चिलर" }, categories: ["film", "art", "market"] },
};
export const vibeLabel = (id: VibeId, lang: Lang) => `${VIBES[id].emoji} ${VIBES[id].name[lang]}`;

export const CATEGORY_STYLE: Record<string, { emoji: string; color: string }> = {
  // Deep enough that white text on them (price badges, map pins) stays readable.
  art: { emoji: "🎨", color: "#E5484D" },
  workshop: { emoji: "✂️", color: "#EA6C1E" },
  food: { emoji: "🍜", color: "#D98A00" },
  music: { emoji: "🎤", color: "#9B51E0" },
  market: { emoji: "🛍️", color: "#0E8FB0" },
  comedy: { emoji: "😂", color: "#E0457B" },
  film: { emoji: "🎬", color: "#3B7DDD" },
  nightlife: { emoji: "🎧", color: "#6D5BD0" },
  sports: { emoji: "🏃", color: "#12A36A" },
};
export const styleOf = (e: Event) => CATEGORY_STYLE[e.category] ?? { emoji: "📌", color: GREEN };

// ---------- formatting ----------

export function when(e: Event, lang: Lang): string {
  const day = new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(e.start_datetime));
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${hm.format(new Date(e.start_datetime))}–${hm.format(new Date(e.end_datetime))}`;
}

export function price(e: Event, lang: Lang): string {
  if (e.price_thb_max === 0) return T[lang].free;
  if (e.price_thb_min === e.price_thb_max) return `฿${e.price_thb_min.toLocaleString("en-US")}`;
  return `฿${e.price_thb_min.toLocaleString("en-US")}–${e.price_thb_max.toLocaleString("en-US")}`;
}

// The data only has Thai and English copy; other languages see the English.
export const title = (e: Event, lang: Lang) => (lang === "th" ? e.title_th : e.title_en);
export const venue = (e: Event, lang: Lang) => (lang === "th" ? e.venue.name_th : e.venue.name_en);
// "🧭 Free local guide · pay only for what you eat · ~120 min" and "Main entrance, Silom Square" (Thai or English copy).
export const guideLine = (e: Event, lang: Lang) =>
  e.guide ? `🧭 ${lang === "th" ? e.guide.includes_th : e.guide.includes_en} · ${T[lang].guideMinutes(e.guide.duration_min)}` : null;
export const meetingPoint = (e: Event, lang: Lang) => (e.guide ? (lang === "th" ? e.guide.meeting_point_th : e.guide.meeting_point_en) : null);

// Review videos of the place: a hand-picked one if the data has it, otherwise YouTube search results, which are
// always real and current (a guessed video link could be dead or about somewhere else).
export function youtubeUrl(e: Event, lang: Lang): string {
  if (e.venue.youtube_url) return e.venue.youtube_url;
  const query = lang === "th" ? `${e.venue.name_th} รีวิว` : `${e.venue.name_en} Bangkok review`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export const transit = (e: Event, lang: Lang) => (lang === "th" ? e.transit_th : e.transit_en);

// Walk-in events need no booking: the user adds them to their calendar and just turns up.
export const isWalkIn = (e: Event) => e.booking === "walk_in";
export const walkInLine = (e: Event, lang: Lang) => (e.price_thb_min > 0 ? T[lang].walkInPaid : T[lang].walkIn);

export function textMessage(text: string, quickReply?: unknown) {
  return quickReply ? { type: "text", text, quickReply } : { type: "text", text };
}

// ---------- onboarding ----------

export function greeting() {
  return textMessage(GREETING);
}

// backTo: the user's current language, when they already have one (so there's somewhere to go back to).
export function languagePicker(backTo?: Lang) {
  return {
    type: "flex",
    altText: CHOOSE_LANGUAGE,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "🌐", size: "3xl", align: "center" },
          { type: "text", text: CHOOSE_LANGUAGE, color: TEXT, weight: "bold", align: "center", wrap: true, margin: "sm" },
          ...LANGS.map((l) => ({
            type: "button",
            style: "secondary",
            color: SUBTLE,
            height: "sm",
            margin: "md",
            action: { type: "postback", label: `${l.flag} ${l.name}`, data: `action=lang&l=${l.id}`, displayText: `${l.flag} ${l.name}` },
          })),
          ...(backTo
            ? [{ type: "button", style: "secondary", color: SUBTLE, height: "sm", margin: "lg", action: { type: "postback", label: M[backTo].back, data: `action=menu&lang=${backTo}`, displayText: M[backTo].back } }]
            : []),
        ],
      },
    },
  };
}

export function welcome(lang: Lang) {
  return textMessage(T[lang].welcome);
}

export function vibePicker(lang: Lang, withBack = false) {
  const items = (Object.keys(VIBES) as VibeId[]).map((id) => ({
    type: "action",
    action: { type: "postback", label: vibeLabel(id, lang), data: `action=vibe&v=${id}&lang=${lang}`, displayText: vibeLabel(id, lang) },
  }));
  const back = withBack ? [{ type: "action", action: { type: "postback", label: M[lang].back, data: `action=menu&lang=${lang}` } }] : [];
  return textMessage(T[lang].pickVibe, { items: [...items, ...back] });
}

export function examplesQuickReply(lang: Lang): { items: { type: string; action: Record<string, string> }[] } {
  const t = T[lang];
  return {
    items: [
      { type: "action", action: { type: "postback", label: M[lang].menu, data: `action=menu&lang=${lang}` } },
      { type: "action", action: { type: "postback", label: M[lang].findShort, data: `action=find&lang=${lang}` } },
      ...t.examples.map(([label, text]) => ({ type: "action", action: { type: "message", label, text } })),
      { type: "action", action: { type: "postback", label: t.language, data: "action=langs" } },
    ],
  };
}

export function vibeChosen(id: VibeId, lang: Lang) {
  return textMessage(T[lang].vibeChosen(vibeLabel(id, lang)), examplesQuickReply(lang));
}

// ---------- results ----------

export function matchReasonText(r: Reason, lang: Lang): string {
  const m = M[lang];
  switch (r.kind) {
    case "vibe": return m.rVibe(vibeLabel(r.vibe, lang));
    case "history": return m.rHistory(m.cat[r.category] ?? r.category);
    case "budget": return m.rBudget;
    case "near": return m.rNear(r.km);
    case "group": return m.rGroup(r.people);
    case "soon": return m.rSoon;
    case "free": return m.rFree;
  }
}

const matchColor = (score: number) => (score >= 80 ? GREEN : score >= 60 ? "#E09A00" : "#8A94A6");
const matchTextColor = (score: number) => (score >= 80 ? GREEN_TEXT : score >= 60 ? WARM : MUTED);

export function eventBubble(e: Event, lang: Lang, tickets = 1, match?: Match) {
  const t = T[lang];
  const s = styleOf(e);
  const walkIn = isWalkIn(e);
  return {
    type: "bubble",
    size: "kilo",
    styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
    hero: {
      type: "box",
      layout: "vertical",
      paddingAll: "0px",
      contents: [
        { type: "image", url: imageUrl(e), size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        {
          type: "box",
          layout: "vertical",
          position: "absolute",
          offsetTop: "10px",
          offsetEnd: "10px",
          backgroundColor: s.color,
          cornerRadius: "20px",
          paddingTop: "3px",
          paddingBottom: "3px",
          paddingStart: "10px",
          paddingEnd: "10px",
          contents: [{ type: "text", text: price(e, lang), color: "#ffffff", size: "xs", weight: "bold" }],
        },
        ...(match
          ? [{
              type: "box",
              layout: "vertical",
              position: "absolute",
              offsetTop: "10px",
              offsetStart: "10px",
              backgroundColor: matchColor(match.score),
              cornerRadius: "20px",
              paddingTop: "3px",
              paddingBottom: "3px",
              paddingStart: "10px",
              paddingEnd: "10px",
              contents: [{ type: "text", text: `🎯 ${match.score}% ${M[lang].matchWord}`, color: "#ffffff", size: "xs", weight: "bold" }],
            }]
          : []),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: `${s.emoji} ${title(e, lang)}`, weight: "bold", size: "md", wrap: true, color: TEXT },
        ...(match?.reasons.length ? [{ type: "text", text: `✨ ${match.reasons.map((r) => matchReasonText(r, lang)).join(" · ")}`, size: "xxs", color: matchTextColor(match.score), wrap: true }] : []),
        { type: "text", text: when(e, lang), size: "xs", color: MUTED, wrap: true },
        ...(e.guide ? [{ type: "text", text: guideLine(e, lang)!, size: "xs", color: WARM, wrap: true }] : []),
        { type: "text", text: `📍 ${venue(e, lang)}`, size: "xs", color: MUTED, wrap: true },
        { type: "text", text: `🚆 ${transit(e, lang)}`, size: "xs", color: MUTED, wrap: true },
        { type: "text", text: walkIn ? walkInLine(e, lang) : t.spotsLeft(e.seats_remaining), size: "xxs", color: GREEN_TEXT, weight: "bold", margin: "md", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: GREEN,
          height: "sm",
          // Walk-in events use the same action: the server adds them to the calendar instead of booking.
          action: walkIn
            ? { type: "postback", label: t.addPlan, data: `action=book&id=${e.id}&n=1&lang=${lang}`, displayText: `${t.addPlan} ${s.emoji} ${title(e, lang)}` }
            : { type: "postback", label: t.book, data: `action=book&id=${e.id}&n=${tickets}&lang=${lang}`, displayText: `${t.book} ${s.emoji} ${title(e, lang)}${tickets > 1 ? ` (${M[lang].ticketsN(tickets)})` : ""}` },
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: t.map, data: `action=map&id=${e.id}&lang=${lang}` } },
            { type: "button", style: "primary", color: "#c4302b", height: "sm", action: { type: "uri", label: T[lang].watchReview, uri: youtubeUrl(e, lang) } },
          ],
        },
      ],
    },
  };
}

function mapBubble(events: Event[], lang: Lang, mapUrl: string) {
  const t = T[lang];
  return {
    type: "bubble",
    size: "kilo",
    styles: { body: { backgroundColor: SOFT_GREEN } },
    body: {
      type: "box",
      layout: "vertical",
      justifyContent: "center",
      spacing: "md",
      contents: [
        { type: "text", text: "🗺️", size: "4xl", align: "center" },
        { type: "text", text: t.seeAllOnMap(events.length), weight: "bold", color: TEXT, align: "center", wrap: true },
        { type: "text", text: events.map((e) => styleOf(e).emoji).join("  "), align: "center", size: "lg" },
        { type: "button", style: "primary", color: GREEN, height: "sm", margin: "lg", action: { type: "uri", label: t.openMap, uri: mapUrl } },
      ],
    },
  };
}

export function eventCarousel(events: Event[], lang: Lang, mapUrl?: string, tickets = 1, quickReply?: unknown, extraBubbles: unknown[] = [], matches?: Map<string, Match>) {
  const bubbles: unknown[] = events.map((e) => eventBubble(e, lang, tickets, matches?.get(e.id)));
  if (mapUrl) bubbles.push(mapBubble(events, lang, mapUrl));
  bubbles.push(...extraBubbles);
  return {
    type: "flex",
    altText: T[lang].altFound(events.length),
    contents: { type: "carousel", contents: bubbles },
    quickReply: quickReply ?? examplesQuickReply(lang),
  };
}

// Plain-text fallback, in case Flex is misbehaving on demo day.
export function eventListText(events: Event[], lang: Lang, quickReply?: unknown, matches?: Map<string, Match>) {
  const lines = events.map((e, i) => {
    const m = matches?.get(e.id);
    return `${i + 1}. ${title(e, lang)}${m ? ` · 🎯 ${m.score}%` : ""}\n${when(e, lang)} · ${price(e, lang)}\n${transit(e, lang)}`;
  });
  return textMessage(lines.join("\n\n"), quickReply ?? examplesQuickReply(lang));
}

export function locationMessage(e: Event, lang: Lang) {
  return {
    type: "location",
    title: title(e, lang).slice(0, 100),
    address: `${venue(e, lang)}, ${e.venue.area}`.slice(0, 100),
    latitude: e.venue.lat,
    longitude: e.venue.lng,
  };
}

// ---------- booking ----------

const gcalStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Opens Google Calendar with the event filled in; the user taps Save. (Adding it silently would need Google sign-in.)
// plan: a walk-in event in the user's calendar, which has no ticket count to mention.
export function googleCalendarUrl(e: Event, code: string, tickets: number, lang: Lang, plan = false) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title(e, lang),
    dates: `${gcalStamp(e.start_datetime)}/${gcalStamp(e.end_datetime)}`,
    location: `${venue(e, lang)}, ${e.venue.area}, Bangkok`,
    details: `Scoop · ${plan ? walkInLine(e, lang) : `${code} · ${M[lang].ticketsN(tickets)}`}${e.venue.phone ? ` · 📞 ${e.venue.phone}` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

// "+66 2 214 6630" -> "tel:+6622146630", "+66(0)-2225-2777" -> "tel:+6622252777", "02 392 1403" -> "tel:023921403".
export const telUri = (phone: string) => `tel:${phone.replace(/\s*(p|ext\.?|x)\s*\d+$/i, "").replace(/\(0\)/g, "").replace(/[^\d+]/g, "")}`;

// The venue's own page: its website, or its Facebook page when that's all there is.
const venuePage = (e: Event) => [e.venue.website, e.venue.info?.facebook].find((u) => u && /^https:\/\//.test(u));

function venueButtons(e: Event, code: string, tickets: number, lang: Lang, plan = false) {
  const page = venuePage(e);
  return [
    { type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "uri", label: T[lang].addToCalendar, uri: googleCalendarUrl(e, code, tickets, lang, plan) } },
    ...(e.venue.phone ? [{ type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "uri", label: T[lang].callVenue, uri: telUri(e.venue.phone) } }] : []),
    ...(page ? [{ type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "uri", label: T[lang].website, uri: page } }] : []),
  ];
}

// The booking confirmation, or for a walk-in event (plan) the "added to your calendar" card.
export function ticket(e: Event, code: string, lang: Lang, tickets = 1, plan = false) {
  const t = T[lang];
  const s = styleOf(e);
  const row = (k: string, v: string) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: k, size: "xs", color: MUTED, flex: 2 },
      { type: "text", text: v, size: "xs", color: TEXT, flex: 5, wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: plan ? t.planAlt(title(e, lang)) : t.bookedAlt(title(e, lang)),
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: plan ? "📅" : "🎉", size: "3xl", align: "center" },
          { type: "text", text: plan ? t.planAdded : t.booked, weight: "bold", size: "lg", align: "center", color: TEXT },
          { type: "separator", color: LINE_SEP },
          { type: "text", text: `${s.emoji} ${title(e, lang)}`, weight: "bold", color: GREEN_TEXT, wrap: true },
          row(t.when, when(e, lang)),
          row(t.where, venue(e, lang)),
          ...(e.venue.info?.address ? [row(t.addressL, e.venue.info.address)] : []),
          ...(e.venue.info?.opening_hours ? [row(t.hoursL, e.venue.info.opening_hours)] : []),
          plan ? row(t.price, price(e, lang)) : row(t.price, `${price(e, lang)} · ${M[lang].ticketsN(tickets)}`),
          ...(plan ? [] : [row(t.code, code)]),
          ...(e.guide ? [row(t.guideMeet, meetingPoint(e, lang)!), row("🧭", guideLine(e, lang)!.replace(/^🧭 /, ""))] : []),
          ...(e.venue.phone ? [row(t.phoneL, e.venue.phone)] : []),
          ...(e.venue.contact_person ? [row(t.contactL, e.venue.contact_person)] : []),
          { type: "separator", color: LINE_SEP },
          { type: "text", text: plan ? t.planNote : t.demoNote, size: "xxs", color: MUTED, align: "center", wrap: true },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: CARD,
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: GREEN, height: "sm", action: { type: "postback", label: M[lang].bookMore, data: `action=find&lang=${lang}`, displayText: M[lang].bookMore } },
          ...venueButtons(e, code, tickets, lang, plan),
          { type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "postback", label: t.ride, data: `action=ride&id=${e.id}&lang=${lang}`, displayText: t.ride } },
          { type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "postback", label: M[lang].myBookings, data: `action=bookings&lang=${lang}`, displayText: M[lang].myBookings } },
        ],
      },
    },
  };
}

// ---------- getting there ----------

export function askLocation(e: Event, lang: Lang) {
  return textMessage(`${T[lang].shareLocation}\n\n📍 ${title(e, lang)}`, {
    items: [
      { type: "action", action: { type: "location", label: T[lang].shareLocationBtn } },
      { type: "action", action: { type: "postback", label: M[lang].back, data: `action=menu&lang=${lang}` } },
    ],
  });
}

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
export { hhmm };

// Ways out of a getting-there screen: a Menu button on the card, and shortcuts under the last card.
const menuButton = (lang: Lang) => ({
  type: "button", style: "secondary", color: SUBTLE, height: "sm", margin: "sm",
  action: { type: "postback", label: M[lang].menu, data: `action=menu&lang=${lang}`, displayText: M[lang].menu },
});

export function navQuickReply(lang: Lang) {
  const m = M[lang];
  return {
    items: [
      { type: "action", action: { type: "postback", label: m.menu, data: `action=menu&lang=${lang}` } },
      { type: "action", action: { type: "postback", label: m.myBookings, data: `action=bookings&lang=${lang}` } },
      { type: "action", action: { type: "postback", label: m.findShort, data: `action=find&lang=${lang}` } },
    ],
  };
}

export function rideButtons(e: Event, from: Point, lang: Lang, withReminder: boolean, publicBase?: string) {
  const t = T[lang];
  return [
    { type: "button", style: "primary", color: "#00b14f", height: "sm", action: { type: "uri", label: t.openGrab, uri: publicBase ? rideAppUrl(publicBase, "grab", e, lang) : GRAB_URL } },
    { type: "button", style: "primary", color: "#06c755", height: "sm", margin: "sm", action: { type: "uri", label: t.openLineman, uri: publicBase ? rideAppUrl(publicBase, "lineman", e, lang) : LINEMAN_URL } },
    { type: "button", style: "secondary", height: "sm", margin: "sm", action: { type: "uri", label: t.directions, uri: directionsUrl(from, e) } },
    ...(withReminder
      ? [{ type: "button", style: "link", color: GREEN_TEXT, height: "sm", margin: "sm", action: { type: "postback", label: t.remindLeave, data: `action=leave&id=${e.id}&lang=${lang}` } }]
      : []),
  ];
}

export function rideCard(e: Event, from: Point, est: RideEstimate, lang: Lang, now: Date, publicBase?: string) {
  const t = T[lang];
  const baht = ([a, b]: [number, number]) => `~฿${a}–${b}`;
  const leave = est.leaveAt.getTime() <= now.getTime() ? t.leaveNow : hhmm(est.leaveAt);
  const row = (k: string, v: string, strong = false) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: k, size: "xs", color: MUTED, flex: 4, wrap: true },
      { type: "text", text: v, size: strong ? "sm" : "xs", color: strong ? GREEN_TEXT : TEXT, weight: strong ? "bold" : "regular", flex: 5, wrap: true, align: "end" },
    ],
  });
  return {
    type: "flex",
    altText: `${t.rideTitle}: ${title(e, lang)}`,
    contents: {
      type: "bubble",
      size: "mega", // same width as transitCard, which is sent right after it
      styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: t.rideTitle, weight: "bold", size: "lg", color: TEXT },
          { type: "text", text: `${styleOf(e).emoji} ${title(e, lang)}`, size: "sm", color: GREEN_TEXT, wrap: true },
          { type: "text", text: `📍 ${venue(e, lang)} · ${when(e, lang)}`, size: "xxs", color: MUTED, wrap: true },
          { type: "separator", color: LINE_SEP, margin: "md" },
          row(t.distance, `~${est.roadKm.toFixed(1)} ${t.km}`),
          row(t.travelTime, `~${est.minutes} ${t.min}`),
          row(t.taxiFare, baht(est.taxi)),
          row(t.appFare, baht(est.app)),
          row(t.leaveBy, leave, true),
          { type: "separator", color: LINE_SEP, margin: "md" },
          { type: "text", text: t.estimateNote, size: "xxs", color: MUTED, wrap: true },
        ],
      },
      footer: { type: "box", layout: "vertical", contents: [...rideButtons(e, from, lang, est.leaveAt.getTime() > now.getTime(), publicBase), menuButton(lang)] },
    },
  };
}

const LINE_COLOR: Record<string, string> = {
  bts_sukhumvit: "#7cb342", bts_silom: "#00796b", mrt_blue: "#1e63c4", mrt_purple: "#7b3fa0",
  mrt_yellow: "#f2c200", mrt_pink: "#e7609b", arl: "#c62828", gold: "#c9a227",
};

// Step-by-step BTS / MRT directions with total time and fare, sent next to the ride card.
export function transitCard(e: Event, from: Point, plan: TransitPlan | null, lang: Lang, now: Date) {
  const t = T[lang];
  const stationName = (s: { name_en: string; name_th: string; ref: string }) => `${lang === "th" ? s.name_th : s.name_en} (${s.ref})`;
  const step = (icon: string, text: string, color = MUTED) => ({
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    contents: [
      { type: "box", layout: "vertical", width: "26px", flex: 0, contents: [{ type: "text", text: icon, size: "md", align: "center" }] },
      { type: "text", text, size: "xs", color, wrap: true, flex: 1 },
    ],
  });
  const lineStep = (line: string, text: string) => ({
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    contents: [
      { type: "box", layout: "vertical", width: "26px", flex: 0, contents: [{ type: "box", layout: "vertical", width: "6px", height: "34px", cornerRadius: "3px", backgroundColor: LINE_COLOR[line] ?? GREEN, offsetStart: "10px", contents: [{ type: "filler" }] }] },
      { type: "text", text, size: "xs", color: TEXT, wrap: true, flex: 1, weight: "bold" },
    ],
  });

  const steps: unknown[] = [];
  for (const leg of plan?.legs ?? []) {
    if (leg.kind === "walk") steps.push(step("🚶", leg.to === "venue" ? t.walkTo(leg.minutes, venue(e, lang)) : t.walkTo(leg.minutes, stationName(leg.station!))));
    if (leg.kind === "ride") steps.push(lineStep(leg.line, t.rideLine(t.lineName[leg.line], lang === "th" ? leg.towards.name_th : leg.towards.name_en, leg.stops, stationName(leg.to), leg.minutes)));
    if (leg.kind === "transfer") steps.push(step("🔁", t.changeAt(stationName(leg.at), leg.minutes)));
  }

  const leave = plan ? (plan.leaveAt.getTime() <= now.getTime() ? t.leaveNow : hhmm(plan.leaveAt)) : null;
  const mapsTransit = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${e.venue.lat},${e.venue.lng}&travelmode=transit`;
  return {
    type: "flex",
    altText: t.transitTitle,
    contents: {
      type: "bubble",
      size: "mega",
      styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: t.transitTitle, weight: "bold", size: "lg", color: TEXT },
          { type: "text", text: `${styleOf(e).emoji} ${title(e, lang)}`, size: "xs", color: MUTED, wrap: true, margin: "xs" },
          ...(plan
            ? [
                { type: "text", text: plan.walkOnly ? t.walkOnly(plan.minutes) : t.transitSummary(plan.minutes, plan.fare), size: "md", weight: "bold", color: GREEN_TEXT, wrap: true, margin: "md" },
                ...(leave ? [{ type: "text", text: `${t.leaveBy} ${leave}`, size: "xs", color: TEXT, margin: "xs" }] : []),
                { type: "separator", color: LINE_SEP, margin: "md" },
                ...steps,
                ...(plan.walkOnly ? [] : [
                  { type: "separator", color: LINE_SEP, margin: "lg" },
                  { type: "text", text: t.transitNote, size: "xxs", color: MUTED, wrap: true, margin: "md" },
                ]),
              ]
            : [{ type: "text", text: t.noTransit, size: "sm", color: TEXT, wrap: true, margin: "md" }]),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "button", style: "secondary", color: SUBTLE, height: "sm", action: { type: "uri", label: t.transitMaps, uri: mapsTransit } }, menuButton(lang)],
      },
    },
  };
}

export function timeToLeave(e: Event, from: Point, lang: Lang, publicBase?: string) {
  return {
    type: "flex",
    altText: T[lang].timeToLeave(title(e, lang)),
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: T[lang].timeToLeave(title(e, lang)), weight: "bold", color: TEXT, wrap: true },
          { type: "text", text: `📍 ${venue(e, lang)} · ${when(e, lang)}`, size: "xs", color: MUTED, wrap: true, margin: "sm" },
          ...rideButtons(e, from, lang, false, publicBase).map((b, i) => ({ ...b, margin: i === 0 ? "lg" : "sm" })),
          menuButton(lang),
        ],
      },
    },
  };
}

export function reminderSetText(e: Event, lang: Lang, at: Date) {
  const label = new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return textMessage(T[lang].reminderSet(title(e, lang), label), examplesQuickReply(lang));
}

// The day-of reminder: what, when, where, how to get there, plus calendar / call / ride buttons.
export function reminderCard(e: Event, code: string, tickets: number, lang: Lang, plan = false) {
  const t = T[lang];
  const line = (text: string, color = MUTED) => ({ type: "text", text, size: "xs", color, wrap: true });
  return {
    type: "flex",
    altText: `${t.reminder} ${title(e, lang)}`,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: t.reminder, weight: "bold", size: "lg", color: TEXT, wrap: true },
          { type: "text", text: `${styleOf(e).emoji} ${title(e, lang)}`, weight: "bold", color: GREEN_TEXT, wrap: true },
          line(`🕒 ${when(e, lang)}`, TEXT),
          line(`📍 ${venue(e, lang)}`),
          line(`🚆 ${transit(e, lang)}`),
          ...(e.guide ? [line(guideLine(e, lang)!, WARM), line(`🤝 ${t.guideMeet}: ${meetingPoint(e, lang)}`, TEXT)] : []),
          ...(e.venue.phone ? [line(`📞 ${e.venue.phone}${e.venue.contact_person ? ` · ${e.venue.contact_person}` : ""}`)] : []),
          ...(e.venue.info?.opening_hours ? [line(`🕘 ${t.hoursL}: ${e.venue.info.opening_hours}`)] : []),
          line(plan ? walkInLine(e, lang) : `🎟️ ${M[lang].ticketsN(tickets)} · ${t.bookingCode} ${code}`),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: GREEN, height: "sm", action: { type: "postback", label: t.ride, data: `action=ride&id=${e.id}&lang=${lang}`, displayText: t.ride } },
          ...venueButtons(e, code, tickets, lang, plan),
          menuButton(lang),
        ],
      },
    },
    quickReply: navQuickReply(lang),
  };
}
