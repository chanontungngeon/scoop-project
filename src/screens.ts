import type { Event } from "./filter.ts";
import { CARD, GREEN, GREEN_TEXT, LINE_SEP, MUTED, SOFT, SOFT_GREEN, SUBTLE, TEXT, VIBES, WARM, googleCalendarUrl, imageUrl, price, styleOf, textMessage, title, vibeLabel, venue, when } from "./flex.ts";
import type { VibeId } from "./flex.ts";
import { LANGS, M, T, localeOf } from "./i18n.ts";
import type { Lang } from "./i18n.ts";
import type { Booking, User, Wizard, WizardWhen } from "./store.ts";

const TZ = "Asia/Bangkok";
const RED = "#e5484d";

type QuickItem = { type: "action"; action: Record<string, unknown> };
const pb = (label: string, data: string, displayText?: string): QuickItem => ({
  type: "action",
  action: displayText ? { type: "postback", label, data, displayText } : { type: "postback", label, data },
});

// Grey buttons use LINE's "secondary" style so their label is dark; coloured ones keep white labels.
const button = (label: string, data: string, color = SUBTLE) => ({
  type: "button",
  style: color === SUBTLE ? "secondary" : "primary",
  color,
  height: "sm",
  action: { type: "postback", label, data, displayText: label },
});

// ---------- home menu ----------

export function menuCard(lang: Lang, headline?: string) {
  const m = M[lang];
  return {
    type: "flex",
    altText: m.menuTitle,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          ...(headline ? [{ type: "text", text: headline, color: GREEN_TEXT, weight: "bold", wrap: true }] : []),
          { type: "text", text: m.menuTitle, color: TEXT, weight: "bold", size: "md", wrap: true, margin: headline ? "md" : "none" },
          { ...button(m.find, `action=find&lang=${lang}`, GREEN), margin: "lg" },
          button(m.myBookings, `action=bookings&lang=${lang}`),
          button(m.getRide, `action=ridemenu&lang=${lang}`),
          button(m.calendar, `action=calendar&lang=${lang}`),
          button(m.profile, `action=profile&lang=${lang}`),
        ],
      },
    },
  };
}

// ---------- step-by-step search: 2 steps, then refine ----------

export const budgetLabel = (v: number | null | undefined, lang: Lang) =>
  v === null || v === undefined ? M[lang].anyBudget : v === 0 ? T[lang].free : `≤ ฿${v.toLocaleString("en-US")}`;

export const peopleLabel = (n: number | null | undefined, lang: Lang) =>
  n === null || n === undefined ? M[lang].anyPeople : n === 1 ? M[lang].justMe : n >= 6 ? M[lang].people(6).replace("6", "6+") : M[lang].people(n);

const CAT_EMOJI: Record<string, string> = { art: "🎨", workshop: "✂️", food: "🍜", music: "🎤", market: "🛍️", comedy: "😂", film: "🎬", nightlife: "🎧", sports: "🏃" };
export const catEmoji = (c: string) => CAT_EMOJI[c] ?? "📌";

function whenText(w: Wizard, lang: Lang): string | null {
  if (!w.when) return null;
  if (w.when === "date" && w.date) {
    return new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${w.date}T12:00:00+07:00`));
  }
  if (w.when === "days") return w.days ? M[lang].nextDays(w.days) : null;
  return w.when === "date" ? null : M[lang].whenLabel[w.when];
}

const HINT = WARM;

const tapAction = (label: string, data: string) => ({ type: "postback", label: label.slice(0, 20), data, displayText: label });

const tile = (icon: string, label: string, action: Record<string, unknown>) => ({
  type: "box",
  layout: "vertical",
  flex: 1,
  spacing: "xs",
  paddingAll: "10px",
  cornerRadius: "12px",
  backgroundColor: SOFT,
  borderWidth: "1px",
  borderColor: LINE_SEP,
  action,
  contents: [
    { type: "text", text: icon, size: "xl", align: "center" },
    { type: "text", text: label, size: "xs", weight: "bold", color: TEXT, align: "center", wrap: true },
  ],
});

const wideTile = (label: string, action: Record<string, unknown>, color: string, textColor = "#ffffff") => ({
  type: "box",
  layout: "vertical",
  paddingAll: "12px",
  cornerRadius: "12px",
  backgroundColor: color,
  margin: "sm",
  action,
  contents: [{ type: "text", text: label, size: "sm", weight: "bold", color: textColor, align: "center", wrap: true }],
});
const softTile = (label: string, action: Record<string, unknown>) => wideTile(label, action, SOFT_GREEN, GREEN_TEXT);

function grid(tiles: unknown[], perRow: number) {
  const rows = [];
  for (let i = 0; i < tiles.length; i += perRow) {
    rows.push({ type: "box", layout: "horizontal", spacing: "sm", margin: "sm", contents: tiles.slice(i, i + perRow) });
  }
  return rows;
}

const progress = (step: number) => ({
  type: "box",
  layout: "horizontal",
  spacing: "xs",
  margin: "sm",
  contents: [0, 1].map((i) => ({ type: "box", layout: "vertical", height: "5px", cornerRadius: "3px", backgroundColor: i <= step ? GREEN : LINE_SEP, contents: [{ type: "filler" }] })),
});

function stepCard(lang: Lang, step: number, title: string, subtitle: string, body: unknown[], hint: boolean) {
  const m = M[lang];
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          ...(hint ? [{ type: "text", text: m.wizardHint, size: "xs", color: HINT, wrap: true, margin: "none" }] : []),
          { type: "text", text: m.stepOf(step + 1, 2), size: "xxs", color: MUTED, margin: hint ? "md" : "none" },
          progress(step),
          { type: "text", text: title, weight: "bold", size: "lg", color: TEXT, wrap: true, margin: "lg" },
          { type: "text", text: subtitle, size: "xs", color: MUTED, wrap: true, margin: "xs" },
          { type: "box", layout: "vertical", margin: "md", contents: body },
          { type: "text", text: m.typeHint, size: "xxs", color: MUTED, wrap: true, margin: "lg" },
          // A visible Back button: quick replies hide behind the keyboard on many phones.
          wideTile(m.back, tapAction(m.back, step > 0 ? `action=wiz&back=1&lang=${lang}` : `action=menu&lang=${lang}`), SOFT, TEXT),
        ],
      },
    },
    quickReply: { items: [...(step > 0 ? [pb(m.back, `action=wiz&back=1&lang=${lang}`)] : []), pb(m.menu, `action=menu&lang=${lang}`)] },
  };
}

export function whenCard(lang: Lang, today: string, maxDate: string, hint = false) {
  const m = M[lang];
  const data = (v: string) => `action=wiz&s=0&v=${v}&lang=${lang}`;
  const when = (icon: string, id: keyof typeof m.whenLabel) => tile(icon, m.whenLabel[id], tapAction(m.whenLabel[id], data(id)));
  const tiles = [
    when("🌙", "tonight"),
    when("☀️", "today"),
    when("🌤️", "tomorrow"),
    when("🎉", "this_weekend"),
    when("🗓️", "this_week"),
    tile("📆", m.pickDate.replace(/^📆\s*/, ""), { type: "datetimepicker", label: m.pickDate.slice(0, 20), data: data("date"), mode: "date", initial: today, min: today, max: maxDate }),
  ];
  return stepCard(lang, 0, m.whenTitle, m.whenSub, [...grid(tiles, 3), softTile(`🤷 ${m.whenLabel.any}`, tapAction(m.whenLabel.any, data("any")))], hint);
}

export function typeCard(w: Wizard, user: User, lang: Lang, hint = false) {
  const m = M[lang];
  const data = (v: string) => `action=wiz&s=1&v=${v}&lang=${lang}`;
  const picked = whenText(w, lang);
  const vibe = user.vibe ? [wideTile(m.myVibe(vibeLabel(user.vibe, lang)), tapAction(vibeLabel(user.vibe, lang), data("vibe")), GREEN)] : [];
  const cats = Object.keys(m.cat).map((c) => tile(catEmoji(c), m.cat[c], tapAction(`${catEmoji(c)} ${m.cat[c]}`, data(c))));
  const subtitle = picked ? `📅 ${picked} · ${m.typeSub}` : m.typeSub;
  return stepCard(lang, 1, m.typeTitle, subtitle, [...vibe, ...grid(cats, 3), softTile(m.surprise, tapAction(m.surprise, data("any")))], hint);
}

// The last card in the results, and the card under "no matches": go back a step, start over, or leave.
export function notQuiteBubble(lang: Lang) {
  const m = M[lang];
  return {
    type: "bubble",
    size: "kilo",
    styles: { body: { backgroundColor: SOFT_GREEN } },
    body: {
      type: "box",
      layout: "vertical",
      justifyContent: "center",
      spacing: "sm",
      contents: [
        { type: "text", text: m.notQuiteTitle, weight: "bold", size: "lg", color: TEXT, align: "center", wrap: true },
        { type: "text", text: m.notQuiteSub, size: "xs", color: MUTED, align: "center", wrap: true },
        { ...button(m.back, `action=back&lang=${lang}`), margin: "lg" },
        button(m.newSearch, `action=find&lang=${lang}`, GREEN),
        button(m.menu, `action=menu&lang=${lang}`),
      ],
    },
  };
}

export function notQuiteCard(lang: Lang, quickReply: unknown) {
  return { type: "flex", altText: M[lang].notQuiteTitle, contents: notQuiteBubble(lang), quickReply };
}

// Shown under results: adjust budget or group size without starting over.
export function refineQuickReply(lang: Lang, budget: number | null, people: number | null) {
  const m = M[lang];
  return {
    items: [
      pb(m.budgetChip(budgetLabel(budget, lang)), `action=refine&k=budget&lang=${lang}`),
      pb(m.peopleChip(peopleLabel(people, lang)), `action=refine&k=people&lang=${lang}`),
      pb(m.newSearch, `action=find&lang=${lang}`),
      pb(m.menu, `action=menu&lang=${lang}`),
    ],
  };
}

export function refinePicker(kind: "budget" | "people", lang: Lang, current: number | null) {
  const m = M[lang];
  const values: (number | null)[] = kind === "budget" ? [0, 300, 500, 1000, 2000, null] : [1, 2, 3, 4, 5, 6, null];
  const label = (v: number | null) => (kind === "budget" ? budgetLabel(v, lang) : peopleLabel(v, lang));
  const items = values.map((v) => pb(v === current ? `✓ ${label(v)}` : label(v), `action=setrefine&k=${kind}&v=${v ?? "any"}&lang=${lang}`, label(v)));
  return textMessage(kind === "budget" ? m.askBudget : m.askPeople, { items: [...items, pb(m.back, `action=results&lang=${lang}`)] });
}

// ---------- my bookings ----------

export type BookingView = { b: Booking; e: Event; ended: boolean };

function bookingBubble({ b, e, ended }: BookingView, lang: Lang) {
  const m = M[lang];
  const s = styleOf(e);
  return {
    type: "bubble",
    size: "kilo",
    styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
    hero: { type: "image", url: imageUrl(e), size: "full", aspectRatio: "20:9", aspectMode: "cover" },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: `${s.emoji} ${title(e, lang)}`, weight: "bold", color: TEXT, wrap: true },
        { type: "text", text: when(e, lang), size: "xs", color: MUTED, wrap: true },
        { type: "text", text: `📍 ${venue(e, lang)}`, size: "xs", color: MUTED, wrap: true },
        {
          type: "text",
          text: `🎟️ ${m.ticketsN(b.tickets)} · ${price(e, lang)} · ${b.code}${ended ? ` · ${m.ended}` : ""}`,
          size: "xs",
          color: ended ? MUTED : GREEN_TEXT,
          wrap: true,
          margin: "md",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: ended
        ? [button(m.map, `action=map&id=${e.id}&lang=${lang}`)]
        : [
            {
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [button(m.ride, `action=ride&id=${e.id}&lang=${lang}`, GREEN), button(m.map, `action=map&id=${e.id}&lang=${lang}`)],
            },
            button(m.editTickets, `action=edit&c=${b.code}&lang=${lang}`),
            ...(b.tickets > 1 ? [button(m.cancelSome, `action=cancelsome&c=${b.code}&lang=${lang}`)] : []),
            button(m.cancelBooking, `action=cancel&c=${b.code}&lang=${lang}`, RED),
          ],
    },
  };
}

export function myBookings(views: BookingView[], lang: Lang) {
  if (views.length === 0) return [textMessage(M[lang].noBookings), menuCard(lang)];
  return [
    {
      type: "flex",
      altText: M[lang].myBookings,
      contents: { type: "carousel", contents: views.slice(0, 10).map((v) => bookingBubble(v, lang)) },
      quickReply: { items: [pb(M[lang].menu, `action=menu&lang=${lang}`), pb(M[lang].findShort, `action=find&lang=${lang}`)] },
    },
  ];
}

export function ticketsPicker(b: Booking, e: Event, lang: Lang, maxTickets: number) {
  const n = Math.max(1, Math.min(10, maxTickets));
  const items = Array.from({ length: n }, (_, i) => i + 1).map((k) =>
    pb(k === b.tickets ? `✓ ${M[lang].ticketsN(k)}` : M[lang].ticketsN(k), `action=settickets&c=${b.code}&n=${k}&lang=${lang}`, M[lang].ticketsN(k)),
  );
  return textMessage(M[lang].howManyTickets(title(e, lang)), { items: [...items, pb(M[lang].back, `action=bookings&lang=${lang}`)] });
}

// Cancel part of a multi-ticket booking: "Cancel 1 · keep 2", ..., "Cancel all 3".
export function cancelSomePicker(b: Booking, e: Event, lang: Lang) {
  const m = M[lang];
  const items = Array.from({ length: Math.min(b.tickets, 10) }, (_, i) => i + 1).map((k) =>
    k === b.tickets
      ? pb(m.cancelAllN(k).slice(0, 20), `action=cancel&c=${b.code}&lang=${lang}`, m.cancelAllN(k))
      : pb(m.cancelK(k, b.tickets - k).slice(0, 20), `action=cancelseats&c=${b.code}&n=${k}&lang=${lang}`, m.cancelK(k, b.tickets - k)),
  );
  return textMessage(m.cancelSomeQ(title(e, lang), b.tickets), { items: [...items, pb(m.back, `action=bookings&lang=${lang}`)] });
}

export function cancelConfirm(b: Booking, e: Event, lang: Lang) {
  const m = M[lang];
  return {
    type: "flex",
    altText: m.cancelQ,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: m.cancelQ, weight: "bold", size: "lg", color: TEXT, wrap: true },
          { type: "text", text: `${styleOf(e).emoji} ${title(e, lang)}`, color: GREEN_TEXT, weight: "bold", wrap: true, margin: "md" },
          { type: "text", text: `${when(e, lang)} · ${m.ticketsN(b.tickets)}`, size: "xs", color: MUTED, wrap: true },
          { ...button(b.tickets > 1 ? m.cancelAllN(b.tickets) : m.yesCancel, `action=cancelyes&c=${b.code}&lang=${lang}`, RED), margin: "lg" },
          ...(b.tickets > 1 ? [button(m.cancelSome, `action=cancelsome&c=${b.code}&lang=${lang}`)] : []),
          button(m.keep, `action=bookings&lang=${lang}`),
        ],
      },
    },
  };
}

// ---------- calendar ----------



export function calendarView(views: BookingView[], lang: Lang) {
  const m = M[lang];
  if (views.length === 0) return [textMessage(m.noBookings), menuCard(lang)];
  const dayFmt = new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  const rows: unknown[] = [];
  let lastDay = "";
  for (const { b, e, ended } of views) {
    const day = dayFmt.format(new Date(e.start_datetime));
    if (day !== lastDay) {
      rows.push({ type: "text", text: day, weight: "bold", color: ended ? MUTED : GREEN_TEXT, size: "sm", margin: rows.length ? "lg" : "md" });
      lastDay = day;
    }
    rows.push({
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "sm",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "md",
          paddingAll: "8px",
          cornerRadius: "8px",
          backgroundColor: SOFT,
          flex: 1,
          action: { type: "uri", label: "Google Calendar", uri: googleCalendarUrl(e, b.code, b.tickets, lang) },
          contents: [
            { type: "text", text: hm.format(new Date(e.start_datetime)), size: "xs", color: MUTED, flex: 0 },
            { type: "text", text: `${styleOf(e).emoji} ${title(e, lang)} · ${m.ticketsN(b.tickets)}`, size: "xs", color: ended ? MUTED : TEXT, wrap: true, flex: 1 },
            { type: "text", text: "＋📅", size: "xs", color: GREEN_TEXT, flex: 0 },
          ],
        },
        ...(ended
          ? []
          : [{
              type: "box",
              layout: "vertical",
              flex: 0,
              paddingAll: "8px",
              cornerRadius: "8px",
              backgroundColor: RED,
              action: { type: "postback", label: m.cancelShort, data: `action=cancel&c=${b.code}&lang=${lang}`, displayText: `${m.cancelShort} ${title(e, lang)}` },
              contents: [{ type: "text", text: m.cancelShort, size: "xxs", color: "#ffffff", weight: "bold", align: "center" }],
            }]),
      ],
    });
  }

  return [
    {
      type: "flex",
      altText: m.calendarTitle,
      contents: {
        type: "bubble",
        size: "mega",
        styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: m.calendarTitle, weight: "bold", size: "lg", color: TEXT },
            { type: "text", text: m.calendarHint, size: "xxs", color: MUTED, wrap: true, margin: "sm" },
            ...rows,
          ],
        },
        footer: { type: "box", layout: "vertical", contents: [button(m.bookMore, `action=find&lang=${lang}`, GREEN)] },
      },
      quickReply: { items: [pb(m.menu, `action=menu&lang=${lang}`), pb(m.myBookings, `action=bookings&lang=${lang}`)] },
    },
  ];
}

// ---------- profile ----------

export function profileCard(lang: Lang, user: User, profile: { displayName?: string; pictureUrl?: string }, upcoming: number) {
  const m = M[lang];
  const row = (k: string, v: string) => ({
    type: "box",
    layout: "horizontal",
    margin: "sm",
    contents: [
      { type: "text", text: k, size: "xs", color: MUTED, flex: 4 },
      { type: "text", text: v, size: "xs", color: TEXT, flex: 5, align: "end", wrap: true },
    ],
  });
  const header = {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    alignItems: "center",
    contents: [
      profile.pictureUrl
        ? { type: "box", layout: "vertical", width: "56px", height: "56px", cornerRadius: "28px", flex: 0, contents: [{ type: "image", url: profile.pictureUrl, size: "full", aspectMode: "cover", aspectRatio: "1:1" }] }
        : { type: "text", text: "👤", size: "3xl", flex: 0 },
      { type: "text", text: profile.displayName ?? "Scoop user", weight: "bold", size: "lg", color: TEXT, wrap: true, flex: 1 },
    ],
  };
  return {
    type: "flex",
    altText: m.profileTitle,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { body: { backgroundColor: CARD }, footer: { backgroundColor: CARD } },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          header,
          { type: "separator", color: LINE_SEP, margin: "lg" },
          row(m.languageL, LANGS.find((l) => l.id === lang)!.name),
          row(m.vibeL, user.vibe ? vibeLabel(user.vibe, lang) : m.notSet),
          row(m.usualBudgetL, user.usualBudget === undefined ? m.notSet : budgetLabel(user.usualBudget, lang)),
          row(m.usualPeopleL, user.usualPeople === undefined ? m.notSet : peopleLabel(user.usualPeople, lang)),
          row(m.upcomingL, String(upcoming)),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          button(m.changeLanguage, "action=langs"),
          button(m.changeVibe, `action=vibes&lang=${lang}`),
          button(m.setBudget, `action=pickbudget&lang=${lang}`),
          button(m.setPeople, `action=pickpeople&lang=${lang}`),
        ],
      },
    },
    quickReply: { items: [pb(m.menu, `action=menu&lang=${lang}`)] },
  };
}

export function usualBudgetPicker(lang: Lang) {
  const items = ([0, 300, 500, 1000, 2000, null] as (number | null)[]).map((b) => pb(budgetLabel(b, lang), `action=setbudget&v=${b ?? "any"}&lang=${lang}`, budgetLabel(b, lang)));
  return textMessage(M[lang].askBudget, { items: [...items, pb(M[lang].back, `action=profile&lang=${lang}`)] });
}

export function usualPeoplePicker(lang: Lang) {
  const items = ([1, 2, 3, 4, 5, 6, null] as (number | null)[]).map((n) => pb(peopleLabel(n, lang), `action=setpeople&v=${n ?? "any"}&lang=${lang}`, peopleLabel(n, lang)));
  return textMessage(M[lang].askPeople, { items: [...items, pb(M[lang].back, `action=profile&lang=${lang}`)] });
}

// ---------- ride from the menu ----------

export function rideBookingPicker(views: BookingView[], lang: Lang) {
  const items = views.slice(0, 12).map(({ e }) => pb(`${styleOf(e).emoji} ${title(e, lang)}`.slice(0, 20), `action=ride&id=${e.id}&lang=${lang}`, `🚕 ${title(e, lang)}`));
  return textMessage(M[lang].chooseBooking, { items });
}

export const vibeCategories = (vibe: VibeId) => VIBES[vibe].categories;
