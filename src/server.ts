import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { ACTIVITIES, EVENTS, TZ, now } from "./data.ts";
import { filterEvents, blockingConstraint } from "./filter.ts";
import type { Event, Filter, Constraint } from "./filter.ts";
import {
  VIBES, askLocation, eventCarousel, matchReasonText, navQuickReply, eventListText, examplesQuickReply, greeting, hhmm, isWalkIn, languagePicker, setImageBase, locationMessage, price,
  reminderCard, reminderSetText, rideCard, transitCard, textMessage, ticket, title, timeToLeave, venue, vibeChosen, vibeLabel, vibePicker, welcome, when,
} from "./flex.ts";
import type { VibeId } from "./flex.ts";
import { M, T, detectLang, isLang, localeOf } from "./i18n.ts";
import type { Lang } from "./i18n.ts";
import { mapPage } from "./map.ts";
import { goPage } from "./go.ts";
import { HISTORY_TURNS, MAX_INPUT_CHARS, MAX_TICKETS, redactNumbers, runAgent } from "./agent.ts";
import type { Facts, ToolHandlers } from "./agent.ts";
import { bkkDate, dayRange, rangeFor, windowFrom } from "./dates.ts";
import { estimateRide } from "./ride.ts";
import type { Point } from "./ride.ts";
import { planTransit } from "./rail.ts";
import { hasSignals, rankEvents } from "./match.ts";
import type { Match, Profile } from "./match.ts";
import {
  calendarView, cancelConfirm, cancelSomePicker, menuCard, myBookings, profileCard, rideBookingPicker, ticketsPicker, usualBudgetPicker,
  usualPeoplePicker, whenCard, typeCard, refineQuickReply, refinePicker, catEmoji, budgetLabel, peopleLabel, notQuiteBubble, notQuiteCard,
} from "./screens.ts";
import type { BookingView } from "./screens.ts";
import { loadState, saveState } from "./store.ts";
import type { Booking, User, Wizard, WizardWhen } from "./store.ts";

const {
  LINE_CHANNEL_SECRET = "",
  LINE_CHANNEL_ACCESS_TOKEN = "",
  PORT = "3000",
  REPLY_MODE = "flex", // set to "text" to skip Flex entirely
  PUBLIC_URL, // optional; otherwise taken from the tunnel's Host header on each webhook call
  REMINDER_DEMO_SECONDS, // e.g. 60 — fire reminders this many seconds after they're set instead of at the real time
} = process.env;

const DEMO_SECONDS = REMINDER_DEMO_SECONDS ? Number(REMINDER_DEMO_SECONDS) : null;
const TRY = process.argv.includes("--try"); // terminal chat: nothing is saved and no reminders are sent

console.log(`Loaded ${EVENTS.length} events.`);

// ---------- search -> LINE messages ----------

function windowLabel(f: Filter, lang: Lang): string {
  const start = new Date(f.date_range.start!);
  const end = new Date(f.date_range.end!);
  const day = new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return day.format(start) === day.format(end)
    ? `${day.format(start)} ${hm.format(start)}–${hm.format(end)}`
    : `${day.format(start)} – ${day.format(end)}`;
}

function emptyText(c: Constraint, f: Filter, lang: Lang): string {
  const t = T[lang];
  const w = windowLabel(f, lang);
  const budget = f.price_max_thb === 0 ? t.free : `฿${f.price_max_thb}`;
  const reason: Record<Constraint, string> = {
    party_size: t.reasonParty(w, f.party_size ?? 1),
    price: t.reasonPrice(w, budget),
    category: t.reasonCategory(w, f.categories.map((c) => M[lang].cat[c] ?? c).join(", ")),
    date: t.reasonDate(w),
  };
  return `${t.noMatch} — ${reason[c]}\n\n${t.noMatchTail}`;
}

// "📅 Sat 19 Sep · 🎨 Art · 💰 ≤ ฿500 · 👥 2 people" — what this search used.
function summaryLine(f: Filter, lang: Lang): string {
  const parts = [`📅 ${windowLabel(f, lang).replace(" 00:00–23:59", "")}`];
  if (f.activities?.length) parts.push(`🏅 ${f.activities.map((a) => a.replace(/_/g, " ")).join(", ")}`);
  else if (f.categories.length) parts.push(f.categories.map((c) => `${catEmoji(c)} ${M[lang].cat[c] ?? c}`).join(", "));
  if (f.price_max_thb !== null) parts.push(`💰 ${budgetLabel(f.price_max_thb, lang)}`);
  if (f.party_size !== null) parts.push(`👥 ${peopleLabel(f.party_size, lang)}`);
  return parts.join(" · ");
}

const RESULTS_SHOWN = 5;

// The events for a search, and the cards that show them: everything that fits the filters, ranked by how well it
// matches this user (vibe, past bookings, usual budget and group size, distance), best 5 shown.
function searchCards(filter: Filter, lang: Lang, profile: Profile, publicBase: string | undefined) {
  const refine = refineQuickReply(lang, filter.price_max_thb, filter.party_size);
  const ranked = rankEvents(filterEvents(EVENTS, filter, EVENTS.length), profile, RESULTS_SHOWN);
  const results = ranked.map((r) => r.e);
  const matches = new Map<string, Match>(hasSignals(profile) ? ranked.map((r) => [r.e.id, r.m]) : []);
  const usedVibe = ranked.some((r) => r.m.reasons.some((x) => x.kind === "vibe"));
  if (results.length === 0) return { results, matches, usedVibe, blocking: blockingConstraint(EVENTS, filter), cards: [notQuiteCard(lang, refine)] };
  const ids = results.map((e) => e.id);
  const tickets = Math.max(1, filter.party_size ?? 1);
  const mapUrl = publicBase ? `${publicBase}/map?ids=${ids.join(",")}&lang=${lang}` : undefined;
  const card = REPLY_MODE === "text" ? eventListText(results, lang, refine, matches) : eventCarousel(results, lang, mapUrl, tickets, refine, [notQuiteBubble(lang)], matches);
  return { results, matches, usedVibe, blocking: undefined, cards: [card] };
}

// Searches started by tapping (step-by-step, refine buttons): a fixed intro line instead of the agent's words.
function searchReply(filter: Filter, lang: Lang, profile: Profile, publicBase: string | undefined) {
  const { results, blocking, cards } = searchCards(filter, lang, profile, publicBase);
  const intro = blocking
    ? `${emptyText(blocking, filter, lang)}\n\n${summaryLine(filter, lang)}`
    : hasSignals(profile)
      ? `${M[lang].rankedFound(results.length, profile.name)}\n${summaryLine(filter, lang)}`
      : `${T[lang].found(results.length, null)}\n${summaryLine(filter, lang)}\n\n${M[lang].matchHint}`;
  return { filter, ids: results.map((e) => e.id), blocking, messages: [textMessage(intro), ...cards] };
}

// ---------- step-by-step search ----------

function wizardFilter(w: Wizard): Filter {
  const range =
    w.when === "date" && w.date ? dayRange(w.date)
    : w.when === "days" && w.days ? dayRange(bkkDate(0), bkkDate(w.days - 1))
    : w.when && w.when !== "any" && w.when !== "date" && w.when !== "days" ? rangeFor(w.when)
    : { start: null, end: null };
  return { date_range: windowFrom(range), price_max_thb: w.budget ?? null, categories: w.cats ?? [], party_size: w.people ?? null };
}

const wizardMessage = (w: Wizard, user: User, lang: Lang) =>
  w.step === 0 ? whenCard(lang, bkkDate(0), bkkDate(60)) : typeCard(w, user, lang);

// ---------- state (saved to data/state.json) ----------

const state = loadState();
const getUser = (userId: string) => (state.users[userId] ??= {});

const eventById = (id: string | null | undefined) => EVENTS.find((e) => e.id === id);
const activeBooking = (code: string | null | undefined) => state.bookings.find((b) => b.code === code && b.status === "active");
const hasEnded = (e: Event) => Date.parse(e.end_datetime) <= now().getTime();

// What the match score knows about someone. A shared location counts for 12 hours.
function profileOf(userId: string, user: User): Profile {
  const booked = state.bookings.filter((b) => b.userId === userId).flatMap((b) => eventById(b.eventId)?.category ?? []);
  const originFresh = user.origin && user.originAt && Date.now() - Date.parse(user.originAt) < 12 * 60 * 60 * 1000;
  return { name: user.name, vibe: user.vibe, bookedCategories: [...new Set(booked)], usualBudget: user.usualBudget, usualPeople: user.usualPeople, origin: originFresh ? user.origin : undefined, now: now() };
}

function bookingViews(userId: string): BookingView[] {
  return state.bookings
    .filter((b) => b.userId === userId && b.status === "active")
    .flatMap((b) => {
      const e = eventById(b.eventId);
      return e ? [{ b, e, ended: hasEnded(e) }] : [];
    })
    .sort((x, y) => Number(x.ended) - Number(y.ended) || Date.parse(x.e.start_datetime) - Date.parse(y.e.start_datetime));
}

const MAX_TIMEOUT = 2 ** 31 - 1;
function runAt(ms: number, fn: () => void) {
  const wait = ms - Date.now();
  if (wait > MAX_TIMEOUT) setTimeout(() => runAt(ms, fn), MAX_TIMEOUT);
  else setTimeout(fn, Math.max(0, wait));
}

// On the day: 08:00 Bangkok time, or 20:00 the evening before for events starting before 10:00.
// Booked too late for that? One hour before the start, if there's still time.
function reminderTime(e: Event, b: Booking): number | null {
  if (DEMO_SECONDS) return Date.parse(b.createdAt) + DEMO_SECONDS * 1000;
  const start = Date.parse(e.start_datetime);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(start));
  const startHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(start)));
  const planned = startHour < 10 ? Date.parse(`${day}T20:00:00+07:00`) - 24 * 60 * 60 * 1000 : Date.parse(`${day}T08:00:00+07:00`);
  if (planned > Date.now()) return planned;
  const hourBefore = start - 60 * 60 * 1000;
  return hourBefore > Date.now() ? hourBefore : null;
}

function scheduleEventReminder(b: Booking) {
  const e = eventById(b.eventId);
  const at = e ? reminderTime(e, b) : null;
  if (!e || at === null || TRY) return;
  runAt(at, () => {
    const current = activeBooking(b.code);
    if (!current) return; // cancelled in the meantime
    void lineApi("/v2/bot/message/push", { to: b.userId, messages: [reminderCard(e, b.code, current.tickets, current.lang, isPlan(current)), locationMessage(e, current.lang)] });
  });
}

function scheduleLeaveReminder(b: Booking) {
  const e = eventById(b.eventId);
  if (!e || !b.leaveAt || !b.origin || Date.parse(b.leaveAt) <= Date.now()) return;
  const origin = b.origin;
  runAt(Date.parse(b.leaveAt), () => {
    if (!activeBooking(b.code)) return;
    void lineApi("/v2/bot/message/push", { to: b.userId, messages: [timeToLeave(e, origin, b.lang, lastPublicBase)] });
  });
}

// On startup: take booked seats out of the event data and re-arm reminders that haven't fired yet.
function restoreState() {
  const active = state.bookings.filter((b) => b.status === "active");
  for (const b of active) {
    const e = eventById(b.eventId);
    if (e && !isPlan(b)) e.seats_remaining -= b.tickets;
    scheduleEventReminder(b);
    scheduleLeaveReminder(b);
  }
  console.log(`Restored ${Object.keys(state.users).length} users and ${active.length} active bookings.`);
}

const newCode = (prefix = "SC") => `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const isPlan = (b: Booking) => b.kind === "plan";

type BookOutcome =
  | { status: "booked" | "already_booked" | "added_to_calendar" | "already_in_calendar"; code: string; tickets: number; messages: unknown[] }
  | { status: "unavailable" | "not_enough_seats"; seats_left: number; messages: unknown[] };

// Books tickets, or for a walk-in event (no booking needed) adds it to the user's calendar: no seats are taken and
// there's no ticket, but it gets the same reminder and shows in My bookings and the calendar.
function book(userId: string, user: User, e: Event, lang: Lang, tickets: number): BookOutcome {
  const existing = state.bookings.find((b) => b.userId === userId && b.eventId === e.id && b.status === "active");
  if (existing) {
    return { status: isPlan(existing) ? "already_in_calendar" : "already_booked", code: existing.code, tickets: existing.tickets, messages: [ticket(e, existing.code, lang, existing.tickets, isPlan(existing))] };
  }

  if (isWalkIn(e)) {
    if (e.status !== "active" || Date.parse(e.start_datetime) <= now().getTime()) {
      return { status: "unavailable", seats_left: 0, messages: [textMessage(T[lang].full, examplesQuickReply(lang))] };
    }
    const b: Booking = { kind: "plan", code: newCode("PL"), userId, eventId: e.id, tickets: 1, lang, status: "active", createdAt: new Date().toISOString() };
    state.bookings.push(b);
    Object.assign(user, { justBooked: true, lastBookedId: e.id });
    scheduleEventReminder(b);
    console.log(JSON.stringify({ planned: e.id, code: b.code }));
    const remindAt = reminderTime(e, b);
    return { status: "added_to_calendar", code: b.code, tickets: 1, messages: [ticket(e, b.code, lang, 1, true), ...(remindAt !== null ? [reminderSetText(e, lang, new Date(remindAt))] : [])] };
  }

  if (e.status !== "active" || Date.parse(e.start_datetime) <= now().getTime() || e.seats_remaining <= 0) {
    return { status: "unavailable", seats_left: Math.max(0, e.seats_remaining), messages: [textMessage(T[lang].full, examplesQuickReply(lang))] };
  }
  if (e.seats_remaining < tickets) {
    return { status: "not_enough_seats", seats_left: e.seats_remaining, messages: [textMessage(M[lang].notEnoughSeats(e.seats_remaining), examplesQuickReply(lang))] };
  }

  e.seats_remaining -= tickets;
  const b: Booking = { code: newCode(), userId, eventId: e.id, tickets, lang, status: "active", createdAt: new Date().toISOString() };
  state.bookings.push(b);
  Object.assign(user, { justBooked: true, lastBookedId: e.id });
  scheduleEventReminder(b);
  console.log(JSON.stringify({ booked: e.id, code: b.code, tickets, seats_left: e.seats_remaining }));

  const remindAt = reminderTime(e, b);
  return { status: "booked", code: b.code, tickets, messages: [ticket(e, b.code, lang, tickets), ...(remindAt !== null ? [reminderSetText(e, lang, new Date(remindAt))] : [])] };
}

// Set a booking's ticket count; 0 cancels it. Shared by the edit/cancel buttons and the chat agent.
function changeTickets(b: Booking, e: Event, n: number): { ok: true } | { ok: false; seats_available: number } {
  if (isPlan(b)) {
    // A calendar entry has no seats: 0 removes it, anything else leaves it as it is.
    if (n <= 0) b.status = "cancelled";
    return { ok: true };
  }
  if (n <= 0) {
    b.status = "cancelled";
    e.seats_remaining += b.tickets;
    console.log(JSON.stringify({ cancelled: b.code, seats_left: e.seats_remaining }));
    return { ok: true };
  }
  if (n > e.seats_remaining + b.tickets) return { ok: false, seats_available: e.seats_remaining + b.tickets };
  e.seats_remaining -= n - b.tickets;
  console.log(JSON.stringify({ tickets: b.code, from: b.tickets, to: n, seats_left: e.seats_remaining }));
  b.tickets = n;
  return { ok: true };
}

// Taxi and train cards from where the user is to the event, train first when it's a real option:
// it's cheaper and more predictable in Bangkok traffic.
function directionCards(e: Event, origin: Point, lang: Lang, publicBase: string | undefined) {
  const est = estimateRide(origin, e);
  const transit = planTransit(origin, e);
  console.log(JSON.stringify({ ride: e.id, km: est.roadKm.toFixed(1), minutes: est.minutes, taxi: est.taxi, transit: transit?.minutes, fare: transit?.fare }));
  const cards = [rideCard(e, origin, est, lang, now(), publicBase), transitCard(e, origin, transit, lang, now())];
  const trainFirst = Boolean(transit && !transit.walkOnly && transit.minutes <= est.minutes + 15);
  const ordered: Record<string, unknown>[] = trainFirst ? cards.reverse() : cards;
  // Menu / My bookings / Find shortcuts under the last card, so there's always a way back.
  ordered[ordered.length - 1] = { ...ordered[ordered.length - 1], quickReply: navQuickReply(lang) };
  return { est, transit, cards: ordered };
}

// ---------- chat agent ----------

const eventLine = (e: Event, lang: Lang) =>
  `${e.id} · ${title(e, lang)} · ${when(e, lang)} · ${price(e, lang)} · ${venue(e, lang)}${e.venue.info?.opening_hours ? ` (venue opening hours: ${e.venue.info.opening_hours})` : ""} · ${isWalkIn(e) ? "no booking needed (walk in)" : `${e.seats_remaining} seats left`}`;
const bookingNote = (e: Event) => (isWalkIn(e) ? "no booking needed: walk in; book_event adds it to their calendar" : "booking required");

const BLOCKED: Record<Constraint, string> = {
  party_size: "events on those dates don't have enough seats left for that many people",
  price: "everything on those dates costs more than the budget",
  category: "there's none of that kind of event on those dates",
  date: "there's nothing on those dates",
};

const IGNORES: Record<Constraint, string> = {
  party_size: "they may not have enough seats for the whole group",
  price: "they cost more than the budget",
  category: "they are a different kind of event",
  date: "they are on other dates",
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown) => {
  const n = typeof v === "string" && v.trim() ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
};
const isDay = (d: string | null): d is string => d !== null && /^\d{4}-\d{2}-\d{2}$/.test(d);
const ORIGIN_FRESH_MS = 60 * 60 * 1000; // a shared location older than this is asked for again

const LANG_NAMES: Record<Lang, string> = { th: "Thai", en: "English", zh: "Chinese", hi: "Hindi" };

function facts(userId: string, user: User, lang: Lang): Facts {
  return {
    name: user.name,
    firstChat: !user.chat?.length,
    language: LANG_NAMES[lang],
    vibe: user.vibe ? `${VIBES[user.vibe].name.en} (${VIBES[user.vibe].categories.join(", ")})` : undefined,
    usualBudget: user.usualBudget,
    usualPeople: user.usualPeople,
    bookings: bookingViews(userId).filter((v) => !v.ended).map(({ b, e }) => `${b.code}: ${isPlan(b) ? "in their calendar, no ticket" : `${b.tickets} ticket(s)`} · ${eventLine(e, lang)}`),
    lastShown: (user.lastShownIds ?? []).flatMap((id, i) => {
      const e = eventById(id);
      return e ? [`${i + 1}. ${eventLine(e, lang)}`] : [];
    }),
    lastSearch: user.lastFilter ? summaryLine(user.lastFilter, "en") : undefined,
    awaiting: user.refining === "budget" ? "a new budget for the latest search" : user.refining === "people" ? "a new group size for the latest search" : undefined,
  };
}

function agentTools(userId: string, user: User, lang: Lang, publicBase: string | undefined): ToolHandlers {
  const onScreen = () => (user.lastShownIds ?? []).flatMap((id, i) => {
    const e = eventById(id);
    return e ? [{ n: i + 1, id: e.id, title: title(e, lang) }] : [];
  });
  // Models refer to events loosely: "e91", "1" for the first card, or part of the title.
  const findEvent = (v: unknown) => {
    const ref = str(v) ?? (typeof v === "number" ? String(v) : null);
    if (!ref) return undefined;
    const shown = onScreen();
    const byId = eventById(ref) ?? eventById(ref.toLowerCase());
    const byPosition = /^\d{1,2}$/.test(ref) ? eventById(shown[Number(ref) - 1]?.id) : undefined;
    const byTitle = ref.length >= 3 && shown.find((s) => s.title.toLowerCase().includes(ref.toLowerCase()) || EVENTS.find((e) => e.id === s.id)?.title_en.toLowerCase().includes(ref.toLowerCase()));
    return byId ?? byPosition ?? (byTitle ? eventById(byTitle.id) : undefined);
  };
  const noEvent = () => ({ result: { error: "No event matches that event_id. Use an id from events_on_screen, or search again.", events_on_screen: onScreen() } });
  // The model can only act on events the user has actually seen as cards, or already booked: never one it guessed.
  const seen = (e: Event) => (user.lastShownIds ?? []).includes(e.id) || bookingViews(userId).some((v) => v.e.id === e.id);
  const notSeen = () => ({ result: { error: "The user hasn't been shown that event. Search first so they can see it as a card.", events_on_screen: onScreen() } });

  return {
    search_events(args) {
      const from = str(args.date_from) ?? (str(args.after_time) ? bkkDate(0) : null);
      const to = str(args.date_to);
      const range = isDay(from) ? dayRange(from, isDay(to) ? to : from, str(args.after_time)) : isDay(to) ? dayRange(bkkDate(0), to) : { start: null, end: null };
      const cats = Array.isArray(args.categories) ? args.categories.filter((c): c is string => typeof c === "string" && EVENTS.some((e) => e.category === c)) : [];
      const people = int(args.party_size);
      const activities = Array.isArray(args.activities) ? [...new Set(args.activities.filter((a): a is string => typeof a === "string" && ACTIVITIES.includes(a)))] : [];
      const filter: Filter = {
        date_range: windowFrom(range), price_max_thb: int(args.price_max_thb), categories: [...new Set(activities.length ? [...cats, "sports"] : cats)], party_size: people && people > 0 ? people : null,
        ...(activities.length ? { activities } : {}),
      };

      const toResult = (events: Event[], matches: Map<string, Match>) => events.map((e, i) => ({
        n: i + 1, id: e.id, title: title(e, lang), category: e.category, when: when(e, lang), price: price(e, lang), venue: venue(e, lang), area: e.venue.area,
        booking: bookingNote(e), ...(isWalkIn(e) ? {} : { seats_left: e.seats_remaining }), ...(e.activity ? { activity: e.activity.replace(/_/g, " ") } : {}),
        match_percent: matches.get(e.id)?.score ?? "unknown (no profile yet)", match_reasons: matches.get(e.id)?.reasons.map((r) => matchReasonText(r, "en")),
      }));
      const searched = summaryLine(filter, "en");
      user.lastFilter = filter;
      user.lastWizard = undefined;

      const found = searchCards(filter, lang, profileOf(userId, user), publicBase);
      if (found.results.length) {
        user.lastShownIds = found.results.map((e) => e.id);
        return { result: { searched, leaned_towards_their_vibe: found.usedVibe, events: toResult(found.results, found.matches) }, messages: found.cards };
      }
      // Nothing matches: drop the one filter that blocked it and show those as the closest options, so the chat has
      // something real to suggest. With nothing close either, the earlier cards stay "on screen".
      const blocking = found.blocking!;
      const relaxed: Filter =
        blocking === "category" ? { ...filter, categories: [], activities: [] }
        : blocking === "price" ? { ...filter, price_max_thb: null }
        : blocking === "party_size" ? { ...filter, party_size: null }
        : { ...filter, date_range: windowFrom({ start: null, end: null }) };
      const close = searchCards(relaxed, lang, profileOf(userId, user), publicBase);
      if (close.results.length) user.lastShownIds = close.results.map((e) => e.id);
      return {
        result: {
          searched,
          events: [],
          why_nothing: BLOCKED[blocking],
          closest_without_that_filter: toResult(close.results, close.matches),
          note: close.results.length ? `None of these fit what the user asked: ${IGNORES[blocking]}. Say that plainly when you suggest them.` : undefined,
        },
        messages: close.results.length ? close.cards : found.cards,
      };
    },

    event_details(args) {
      const e = findEvent(args.event_id);
      if (!e) return noEvent();
      return {
        result: {
          id: e.id, title: title(e, lang), description: lang === "th" ? e.description_short_th : e.description_short_en, category: e.category,
          when: when(e, lang), price: price(e, lang), booking: bookingNote(e), ...(isWalkIn(e) ? {} : { seats_left: e.seats_remaining }), venue: venue(e, lang), area: e.venue.area,
          getting_there: lang === "th" ? e.transit_th : e.transit_en, phone: e.venue.phone ?? null, website: e.venue.website ?? null,
          venue_kind: e.venue.venue_type === "public" ? "public place" : "business", activity: e.activity?.replace(/_/g, " "),
          venue_opening_hours: e.venue.info?.opening_hours ?? "not known (don't guess, and don't give the event's time instead)", address: e.venue.info?.address, email: e.venue.info?.email, facebook: e.venue.info?.facebook,
          instagram: e.venue.info?.instagram, wheelchair_access: e.venue.info?.wheelchair, cuisine: e.venue.info?.cuisine, about_the_place: e.venue.info?.description,
          guide: e.guide ? { includes: e.guide.includes_en, meeting_point: e.guide.meeting_point_en, duration_min: e.guide.duration_min, languages: e.guide.languages } : null,
        },
      };
    },

    book_event(args) {
      const e = findEvent(args.event_id);
      if (!e) return noEvent();
      if (!seen(e)) return notSeen();
      const n = int(args.tickets);
      if (n && n > MAX_TICKETS) return { result: { error: `At most ${MAX_TICKETS} tickets per booking. Suggest calling the venue for bigger groups.` } };
      const out = book(userId, user, e, lang, n && n > 0 ? n : 1);
      const { messages, ...result } = out;
      // A failed booking is explained by the agent in its own words; only a ticket is worth a card.
      return { result, messages: out.status === "unavailable" || out.status === "not_enough_seats" ? undefined : messages };
    },

    change_booking(args) {
      const b = activeBooking(str(args.code)?.toUpperCase());
      const e = eventById(b?.eventId);
      if (!b || !e || b.userId !== userId) return { result: { error: "No active booking with that code" } };
      if (hasEnded(e)) return { result: { error: "That event has already finished" } };
      const n = Math.max(0, int(args.tickets) ?? 0);
      if (isPlan(b) && n > 0) return { result: { error: "That's a walk-in event in their calendar: there are no tickets to change. tickets = 0 removes it from the calendar." } };
      if (n > MAX_TICKETS) return { result: { error: `At most ${MAX_TICKETS} tickets per booking. Suggest calling the venue for bigger groups.` } };
      const r = changeTickets(b, e, n);
      if (!r.ok) return { result: { error: "Not enough seats", seats_available: r.seats_available } };
      if (n === 0) return { result: { status: isPlan(b) ? "removed_from_calendar" : "cancelled", code: b.code }, messages: myBookings(bookingViews(userId), lang) };
      return { result: { status: "updated", code: b.code, tickets: n }, messages: [ticket(e, b.code, lang, n)] };
    },

    get_directions(args) {
      const e = findEvent(args.event_id) ?? (args.event_id ? undefined : eventById(user.lastBookedId));
      if (!e) return noEvent();
      if (!seen(e)) return notSeen();
      const fresh = user.origin && user.originAt && Date.now() - Date.parse(user.originAt) < ORIGIN_FRESH_MS;
      if (!user.origin || !fresh) {
        user.rideFor = e.id;
        return { result: { needs_location: true, note: "A button to share their location is shown under your reply. Directions arrive once they tap it." }, messages: [askLocation(e, lang)] };
      }
      const { est, transit, cards } = directionCards(e, user.origin, lang, publicBase);
      return {
        result: {
          taxi: { minutes: est.minutes, meter_fare_thb: est.taxi, grab_lineman_fare_thb: est.app, leave_by: hhmm(est.leaveAt) },
          train: transit ? { minutes: transit.minutes, fare_thb: transit.fare, walk_only: transit.walkOnly } : null,
        },
        messages: cards,
      };
    },

    async show_screen(args) {
      const views = bookingViews(userId);
      switch (str(args.screen)) {
        case "menu": return { result: { shown: "menu" }, messages: [menuCard(lang)] };
        case "bookings": return { result: { shown: "bookings" }, messages: myBookings(views, lang) };
        case "calendar": return { result: { shown: "calendar" }, messages: calendarView(views, lang) };
        case "profile": {
          const profile = TRY ? {} : await lineProfile(userId);
          return { result: { shown: "profile" }, messages: [profileCard(lang, user, profile, views.filter((v) => !v.ended).length)] };
        }
        case "language": return { result: { shown: "language picker" }, messages: [languagePicker(user.lang)] };
        case "vibe": return { result: { shown: "vibe picker" }, messages: [vibePicker(lang, Boolean(user.lang))] };
        default: return { result: { error: "Unknown screen" } };
      }
    },
  };
}

// One typed message through the agent: its reply first, then the cards its tools produced (LINE allows 5 messages).
async function agentReply(typed: string, userId: string, user: User, chosenLang: Lang, publicBase: string | undefined) {
  const text = redactNumbers(typed);
  // Reply in what they typed: Thai, Chinese or Hindi script, or English for Latin letters, even if they picked another language.
  const lang = detectLang(text) ?? (/[a-z]/i.test(text) ? "en" : chosenLang);
  const out = await runAgent(text, { facts: facts(userId, user, lang), history: user.chat ?? [], tools: agentTools(userId, user, lang, publicBase) });
  user.refining = undefined;
  user.chat = [...(user.chat ?? []), { role: "user" as const, content: text.slice(0, MAX_INPUT_CHARS) }, ...(out.reply ? [{ role: "assistant" as const, content: out.reply }] : [])].slice(-HISTORY_TURNS);
  console.log(JSON.stringify({ text, reply: out.reply, calls: out.calls.map((c) => ({ tool: c.name, args: c.args })) }));
  const messages = [...(out.reply ? [textMessage(out.reply.slice(0, 5000))] : []), ...out.cards].slice(0, 5);
  return { ...out, messages: messages.length ? messages : [textMessage(T[lang].sorry)] };
}

// ---------- LINE API ----------

async function lineApi(path: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`https://api.line.me${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) console.error(`LINE ${path} -> ${res.status}\n${text}\nRequest body: ${JSON.stringify(body)}`);
  return { ok: res.ok, status: res.status, text };
}

async function lineProfile(userId: string): Promise<{ displayName?: string; pictureUrl?: string }> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } });
  if (!res.ok) {
    console.error(`LINE profile -> ${res.status} ${await res.text()}`);
    return {};
  }
  return (await res.json()) as { displayName?: string; pictureUrl?: string };
}

// Reply tokens are single-use and short-lived; if the LLM took too long, fall back to push.
async function send(replyToken: string, userId: string | undefined, messages: unknown[]) {
  const r = await lineApi("/v2/bot/message/reply", { replyToken, messages });
  if (!r.ok && r.status === 400 && /reply token/i.test(r.text) && userId) {
    console.warn("Reply token rejected, retrying with push API");
    await lineApi("/v2/bot/message/push", { to: userId, messages });
  }
}

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string; latitude?: number; longitude?: number };
  postback?: { data: string; params?: { date?: string } };
};

// ---------- greeting image (assets/greeting.jpg or .png, served through the tunnel) ----------

const ASSETS_DIR = fileURLToPath(new URL("../assets/", import.meta.url));
const GREETING_FILE = ["greeting.jpg", "greeting.jpeg", "greeting.png"].find((f) => existsSync(ASSETS_DIR + f));

// LINE wants a preview under 1 MB; shrink a copy with macOS `sips` if the original is bigger.
// No `sips` (Linux / Docker): use a preview made earlier on a Mac, if there is one.
let greetingPreview = GREETING_FILE;
if (GREETING_FILE && statSync(ASSETS_DIR + GREETING_FILE).size > 1_000_000) {
  try {
    execFileSync("sips", ["-Z", "1024", "-s", "format", "jpeg", "-s", "formatOptions", "80", ASSETS_DIR + GREETING_FILE, "--out", ASSETS_DIR + "greeting-preview.jpg"], { stdio: "ignore" });
    greetingPreview = "greeting-preview.jpg";
  } catch {
    if (existsSync(ASSETS_DIR + "greeting-preview.jpg")) greetingPreview = "greeting-preview.jpg";
    else console.warn("Could not make a greeting preview; LINE may reject images over 1 MB.");
  }
}

const greetingImage = (publicBase: string | undefined) =>
  GREETING_FILE && publicBase
    ? [{ type: "image", originalContentUrl: `${publicBase}/assets/${GREETING_FILE}`, previewImageUrl: `${publicBase}/assets/${greetingPreview}` }]
    : [];

async function processEvent(ev: LineEvent, publicBase?: string) {
  const sourceUserId = ev.source?.userId;
  if (!ev.replyToken || !sourceUserId) return;
  const userId: string = sourceUserId;
  const replyToken = ev.replyToken;
  const user = getUser(userId);
  const reply = (messages: unknown[]) => send(replyToken, userId, messages);

  try {
    // New friend: greet in every language, then ask which one to use.
    if (ev.type === "follow") return await reply([...greetingImage(publicBase), greeting(), languagePicker()]);

    if (ev.type === "message" && ev.message?.type === "text" && ev.message.text) return await onText(ev.message.text);
    if (ev.type === "message" && ev.message?.type === "location") return await onLocation(ev.message.latitude, ev.message.longitude);
    if (ev.type === "postback" && ev.postback) return await onPostback(new URLSearchParams(ev.postback.data), ev.postback.params);

    if (ev.type === "message") {
      // Stickers, photos, ...
      const lang = user.lang ?? "en";
      const headline = user.justBooked ? T[lang].nextTrip : undefined;
      user.justBooked = false;
      return await reply([menuCard(lang, headline)]);
    }
  } finally {
    saveState(state);
  }

  // Every typed message goes to the chat agent. A step-by-step search left open is dropped: they've moved on to talking.
  async function onText(text: string) {
    const lang = detectLang(text) ?? user.lang ?? "en";
    user.lang ??= lang;
    user.wizard = undefined;
    user.justBooked = false;
    void lineApi("/v2/bot/chat/loading/start", { chatId: userId, loadingSeconds: 60 });
    try {
      if (!user.name) user.name = (await lineProfile(userId)).displayName;
      return reply((await agentReply(text, userId, user, lang, publicBase)).messages);
    } catch (err) {
      console.error("Failed to handle message:", err);
      return reply([textMessage(T[lang].sorry)]);
    }
  }

  async function onLocation(lat: number | undefined, lng: number | undefined) {
    const lang = user.lang ?? "en";
    const event = eventById(user.rideFor ?? user.lastBookedId);
    if (lat === undefined || lng === undefined || !event) return reply([textMessage(T[lang].bookFirst), menuCard(lang)]);
    Object.assign(user, { origin: { lat, lng }, originAt: new Date().toISOString(), rideFor: undefined });
    return reply(directionCards(event, { lat, lng }, lang, publicBase).cards);
  }

  // Next step, or the results once both are answered.
  function advanceWizard(w: Wizard, lang: Lang): unknown[] {
    if (w.step < 2) return [wizardMessage(w, user, lang)];
    user.wizard = undefined;
    const out = searchReply(wizardFilter(w), lang, profileOf(userId, user), publicBase);
    user.lastFilter = out.filter;
    user.lastShownIds = out.ids;
    user.lastWizard = { when: w.when, date: w.date, days: w.days, cats: w.cats };
    console.log(JSON.stringify({ wizard: w, ids: out.ids, blocking: out.blocking }));
    return out.messages;
  }

  // Re-run the last search with a new budget or group size; remember it as their usual.
  function refineSearch(kind: "budget" | "people", value: number | null, lang: Lang): unknown[] {
    const base = user.lastFilter;
    if (!base) return [menuCard(lang)];
    const filter: Filter = kind === "budget" ? { ...base, price_max_thb: value } : { ...base, party_size: value };
    if (kind === "budget") user.usualBudget = value;
    else user.usualPeople = value;
    const out = searchReply(filter, lang, profileOf(userId, user), publicBase);
    user.lastFilter = out.filter;
    user.lastShownIds = out.ids;
    console.log(JSON.stringify({ refine: kind, value, ids: out.ids, blocking: out.blocking }));
    return out.messages;
  }

  async function onPostback(p: URLSearchParams, params: { date?: string } | undefined) {
    const langParam = p.get("lang");
    // The language they picked wins over the one baked into an old button, so earlier messages follow a language change.
    const lang: Lang = user.lang ?? (isLang(langParam) ? langParam : "en");
    const action = p.get("action");
    console.log(JSON.stringify({ postback: p.toString(), params }));

    // A bottom-menu tap (no language in it) from someone who hasn't picked a language: ask first, then carry on.
    if (!user.lang && !isLang(langParam) && action !== "lang" && action !== "langs") {
      user.pendingAction = p.toString();
      return reply([languagePicker()]);
    }
    const event = eventById(p.get("id"));
    const booking = activeBooking(p.get("c"));
    const bookingEvent = eventById(booking?.eventId);
    if (action !== "book") user.justBooked = false;
    if (action !== "refine") user.refining = undefined;

    switch (action) {
      // onboarding
      case "lang": {
        const chosen = p.get("l");
        if (!isLang(chosen)) return;
        const firstTime = !user.lang;
        user.lang = chosen;
        const pending = user.pendingAction;
        user.pendingAction = undefined;
        if (pending) return onPostback(new URLSearchParams(`${pending}&lang=${chosen}`), undefined);
        if (firstTime) return reply([welcome(chosen), vibePicker(chosen)]);
        // Changing language later: confirm and go to the menu; reminders for their bookings switch too.
        for (const b of state.bookings) if (b.userId === userId && b.status === "active") b.lang = chosen;
        return reply([textMessage(M[chosen].languageChanged), menuCard(chosen)]);
      }
      case "langs":
        return reply([languagePicker(user.lang)]);
      case "vibes":
        return reply([vibePicker(lang, true)]);
      case "vibe": {
        const v = p.get("v");
        if (!v || !(v in VIBES)) return;
        user.vibe = v as VibeId;
        return reply([vibeChosen(user.vibe, lang), menuCard(lang)]);
      }
      case "menu":
        return reply([menuCard(lang)]);

      // step-by-step search
      case "find":
        user.wizard = { step: 0 };
        return reply([wizardMessage(user.wizard, user, lang)]);
      case "wiz": {
        if (p.get("back")) {
          const w = (user.wizard ??= { step: 0 });
          w.step = Math.max(0, w.step - 1);
          return reply([wizardMessage(w, user, lang)]);
        }
        const step = Number(p.get("s"));
        const v = p.get("v") ?? "any";
        const w: Wizard = user.wizard ?? { step };
        if (step === 0) Object.assign(w, { when: v as WizardWhen, date: v === "date" ? params?.date : undefined, days: undefined });
        if (step === 1) w.cats = v === "any" ? [] : v === "vibe" && user.vibe ? VIBES[user.vibe].categories : [v];
        w.step = step + 1;
        user.wizard = w;
        return reply(advanceWizard(w, lang));
      }

      // "← Back" from results: to the type step of the search that produced them, or the menu for a typed search.
      case "back":
        if (!user.lastWizard) return reply([menuCard(lang)]);
        user.wizard = { ...user.lastWizard, cats: undefined, step: 1 };
        return reply([wizardMessage(user.wizard, user, lang)]);
      case "results":
        return reply(user.lastFilter ? searchReply(user.lastFilter, lang, profileOf(userId, user), publicBase).messages : [menuCard(lang)]);

      case "refine": {
        const kind = p.get("k");
        if (kind !== "budget" && kind !== "people") return;
        if (!user.lastFilter) return reply([menuCard(lang)]);
        user.refining = kind;
        return reply([refinePicker(kind, lang, kind === "budget" ? user.lastFilter.price_max_thb : user.lastFilter.party_size)]);
      }
      case "setrefine": {
        const kind = p.get("k");
        if (kind !== "budget" && kind !== "people") return;
        user.refining = undefined;
        const v = p.get("v");
        return reply(refineSearch(kind, v === "any" ? null : Number(v), lang));
      }

      // results and booking
      case "map":
        return event ? reply([locationMessage(event, lang)]) : undefined;
      case "book":
        return event ? reply(book(userId, user, event, lang, Math.max(1, Number(p.get("n")) || 1)).messages) : undefined;
      case "bookings":
        return reply(myBookings(bookingViews(userId), lang));
      case "edit":
        if (!booking || !bookingEvent || hasEnded(bookingEvent) || isPlan(booking)) return reply(myBookings(bookingViews(userId), lang));
        return reply([ticketsPicker(booking, bookingEvent, lang, bookingEvent.seats_remaining + booking.tickets)]);
      case "settickets": {
        const n = Number(p.get("n"));
        if (!booking || !bookingEvent || !(n >= 1) || isPlan(booking)) return reply(myBookings(bookingViews(userId), lang));
        const r = changeTickets(booking, bookingEvent, n);
        if (!r.ok) return reply([textMessage(M[lang].notEnoughSeats(r.seats_available))]);
        return reply([textMessage(M[lang].ticketsUpdated(n)), ticket(bookingEvent, booking.code, lang, n)]);
      }
      case "cancel":
        return booking && bookingEvent ? reply([cancelConfirm(booking, bookingEvent, lang)]) : reply(myBookings(bookingViews(userId), lang));
      case "cancelsome":
        if (!booking || !bookingEvent || booking.tickets < 2 || isPlan(booking)) return reply(myBookings(bookingViews(userId), lang));
        return reply([cancelSomePicker(booking, bookingEvent, lang)]);
      case "cancelseats": {
        const k = Number(p.get("n"));
        if (!booking || !bookingEvent || !(k >= 1)) return reply(myBookings(bookingViews(userId), lang));
        if (k >= booking.tickets || isPlan(booking)) return reply([cancelConfirm(booking, bookingEvent, lang)]);
        changeTickets(booking, bookingEvent, booking.tickets - k);
        return reply([textMessage(M[lang].cancelledSome(k, booking.tickets, title(bookingEvent, lang))), ...myBookings(bookingViews(userId), lang)]);
      }
      case "cancelyes": {
        if (!booking || !bookingEvent) return reply(myBookings(bookingViews(userId), lang));
        changeTickets(booking, bookingEvent, 0);
        // Back to what's left, so it's easy to cancel another one.
        const remaining = bookingViews(userId);
        const done = isPlan(booking) ? M[lang].removed(title(bookingEvent, lang)) : M[lang].cancelled(title(bookingEvent, lang));
        return reply(remaining.length ? [textMessage(done), ...myBookings(remaining, lang)] : [menuCard(lang, done)]);
      }
      case "calendar":
        return reply(calendarView(bookingViews(userId), lang));
      case "profile": {
        const upcoming = bookingViews(userId).filter((v) => !v.ended).length;
        return reply([profileCard(lang, user, await lineProfile(userId), upcoming)]);
      }
      case "pickbudget":
        return reply([usualBudgetPicker(lang)]);
      case "pickpeople":
        return reply([usualPeoplePicker(lang)]);
      case "setbudget":
      case "setpeople": {
        const v = p.get("v");
        const value = v === "any" ? null : Number(v);
        if (action === "setbudget") user.usualBudget = value;
        else user.usualPeople = value;
        const upcoming = bookingViews(userId).filter((x) => !x.ended).length;
        return reply([textMessage(M[lang].saved), profileCard(lang, user, await lineProfile(userId), upcoming)]);
      }

      // getting there
      case "ridemenu": {
        const upcoming = bookingViews(userId).filter((v) => !v.ended);
        if (upcoming.length === 0) return reply([textMessage(T[lang].bookFirst), menuCard(lang)]);
        if (upcoming.length > 1) return reply([rideBookingPicker(upcoming, lang)]);
        user.rideFor = upcoming[0].e.id;
        return reply([askLocation(upcoming[0].e, lang)]);
      }
      case "ride":
        if (!event) return;
        user.rideFor = event.id;
        return reply([askLocation(event, lang)]);
      case "leave": {
        const b = state.bookings.find((x) => x.userId === userId && x.eventId === event?.id && x.status === "active");
        if (!event || !b || !user.origin) return reply([textMessage(T[lang].bookFirst), menuCard(lang)]);
        const est = estimateRide(user.origin, event);
        b.origin = user.origin;
        b.leaveAt = new Date(DEMO_SECONDS ? Date.now() + DEMO_SECONDS * 1000 : est.leaveAt.getTime()).toISOString();
        scheduleLeaveReminder(b);
        return reply([textMessage(T[lang].leaveReminderSet(hhmm(est.leaveAt), DEMO_SECONDS), examplesQuickReply(lang))]);
      }
    }
  }
}

// ---------- HTTP ----------

function validSignature(raw: Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", LINE_CHANNEL_SECRET).update(raw).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const queues = new Map<string, Promise<void>>();
let lastPublicBase: string | undefined; // for pushes that happen later, outside a webhook call

let lineChatUrl: string | undefined; // https://line.me/R/ti/p/@basicId — opens Scoop in LINE from a browser page

function startServer() {
  restoreState();
  fetch("https://api.line.me/v2/bot/info", { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then((info: { basicId?: string } | null) => { if (info?.basicId) lineChatUrl = `https://line.me/R/ti/p/${encodeURIComponent(info.basicId)}`; })
    .catch(() => {});
  for (const k of ["LINE_CHANNEL_SECRET", "LINE_CHANNEL_ACCESS_TOKEN"]) {
    if (!process.env[k]) console.warn(`⚠️  ${k} is not set`);
  }

  const app = express();
  app.get("/", (_req, res) => { res.send("Scoop is running"); });
  app.use("/assets", express.static(ASSETS_DIR));

  app.get("/go/:app", (req, res) => {
    const app = req.params.app;
    const event = eventById(String(req.query.id));
    if ((app !== "grab" && app !== "lineman") || !event) { res.status(404).send("Not found"); return; }
    const lang = String(req.query.lang);
    res.type("html").send(goPage(app, event, isLang(lang) ? lang : "en", lineChatUrl));
  });

  app.get("/map", (req, res) => {
    const ids = String(req.query.ids ?? "").split(",");
    const events = ids.map((id) => eventById(id)).filter((e): e is Event => Boolean(e));
    if (events.length === 0) { res.status(404).send("No events"); return; }
    const lang = String(req.query.lang);
    res.type("html").send(mapPage(events, isLang(lang) ? lang : "en"));
  });

  // Raw body is required: the signature is over the exact bytes LINE sent.
  app.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
    const raw = req.body as Buffer;
    if (!Buffer.isBuffer(raw) || !validSignature(raw, req.header("x-line-signature"))) {
      console.warn("Rejected webhook: bad signature");
      res.sendStatus(401);
      return;
    }
    res.sendStatus(200);

    const host = req.get("x-forwarded-host") ?? req.get("host") ?? "";
    const publicBase = PUBLIC_URL ?? (/^(localhost|127\.)/.test(host) ? undefined : `https://${host}`);
    if (publicBase) lastPublicBase = publicBase;
    setImageBase(publicBase);
    const body = JSON.parse(raw.toString("utf8")) as { events: LineEvent[] };
    for (const ev of body.events ?? []) {
      // One user's messages are handled in order: a quick second tap waits for the first reply.
      const key = ev.source?.userId ?? "anonymous";
      const next = (queues.get(key) ?? Promise.resolve())
        .then(() => processEvent(ev, publicBase))
        .catch((err) => console.error("Unhandled event error:", err));
      queues.set(key, next);
      void next.finally(() => { if (queues.get(key) === next) queues.delete(key); });
    }
  });

  app.listen(Number(PORT), () => console.log(`Scoop listening on http://localhost:${PORT}/webhook`));
}

// Chat with the agent in the terminal, no LINE needed. Bookings live only as long as the session.
//   npm run try                                  a conversation
//   npm run try -- "หาอะไรทำเสาร์นี้ งบไม่เกิน 500"   one message
async function tryChat(first: string) {
  const user: User = { name: "Tester" };
  const say = async (text: string) => {
    const out = await agentReply(text, "try-user", user, detectLang(text) ?? user.lang ?? "en", undefined);
    for (const c of out.calls) console.log(`  🔧 ${c.name} ${JSON.stringify(c.args)}\n     → ${JSON.stringify(c.result).slice(0, 300)}`);
    for (const m of out.messages as { type: string; text?: string; altText?: string }[]) console.log(m.type === "text" ? `\nScoop: ${m.text}` : `  [card] ${m.altText ?? m.type}`);
  };
  if (first) return say(first);
  console.log("Chat with Scoop (Ctrl+D to quit)");
  process.stdout.write("\nYou: ");
  for await (const text of createInterface({ input: process.stdin })) { // buffers lines, so a piped script works too
    if (!process.stdin.isTTY) console.log(text);
    if (text.trim()) await say(text).catch((err) => console.error(err));
    process.stdout.write("\nYou: ");
  }
}

if (TRY) {
  tryChat(process.argv.slice(process.argv.indexOf("--try") + 1).join(" ")).then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
} else {
  startServer();
}
