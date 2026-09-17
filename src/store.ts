import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { ChatTurn } from "./agent.ts";
import type { Filter } from "./filter.ts";
import type { VibeId } from "./flex.ts";
import type { Lang } from "./i18n.ts";
import type { Point } from "./ride.ts";

// Everything Scoop remembers, kept in one JSON file so a restart doesn't lose bookings. No database.

export type WizardWhen = "tonight" | "today" | "tomorrow" | "this_saturday" | "this_sunday" | "this_weekend" | "this_week" | "date" | "days" | "any";

export type Wizard = {
  step: number; // 0 when, 1 type of event
  when?: WizardWhen;
  date?: string; // YYYY-MM-DD when `when` is "date"
  days?: number; // today plus the following days when `when` is "days"
  budget?: number | null; // null = any
  people?: number | null;
  cats?: string[];
};

export type User = {
  name?: string; // LINE display name, so the chat can use it
  chat?: ChatTurn[]; // recent typed messages and Scoop's replies, for the chat agent
  lastShownIds?: string[]; // events on screen from the latest search, so "book the second one" works
  lang?: Lang;
  vibe?: VibeId;
  usualBudget?: number | null;
  usualPeople?: number | null;
  wizard?: Wizard;
  lastWizard?: Pick<Wizard, "when" | "date" | "days" | "cats">; // lets "← Back" on results return to the type step
  lastFilter?: Filter; // the search behind the results on screen, so budget / group size can be refined
  refining?: "budget" | "people"; // a refine button asked for a new value; the chat agent is told, in case they type it
  pendingAction?: string; // a menu tap made before choosing a language, replayed once they pick one
  justBooked?: boolean; // the last thing they did was book; a sticker or photo afterwards gets the menu
  lastBookedId?: string;
  rideFor?: string; // event we're waiting on a location for
  origin?: Point;
  originAt?: string; // when they shared that location
};

export type Booking = {
  // "plan": a walk-in event the user added to their calendar. No ticket and no seats taken; it still gets reminders
  // and shows in My bookings and the calendar. Bookings made before this existed have no kind and are tickets.
  kind?: "plan";
  code: string;
  userId: string;
  eventId: string;
  tickets: number;
  lang: Lang;
  status: "active" | "cancelled";
  createdAt: string;
  leaveAt?: string; // "remind me to leave" time, if they asked for one
  origin?: Point;
};

type State = { users: Record<string, User>; bookings: Booking[] };

const DIR = new URL("../data/", import.meta.url);
const FILE = new URL("state.json", DIR);

export function loadState(): State {
  if (!existsSync(FILE)) return { users: {}, bookings: [] };
  const s = JSON.parse(readFileSync(FILE, "utf8")) as Partial<State>;
  return { users: s.users ?? {}, bookings: s.bookings ?? [] };
}

let pending: NodeJS.Timeout | undefined;

// Coalesce bursts of changes into one write; write to a temp file first so a crash can't leave half a file.
export function saveState(state: State) {
  clearTimeout(pending);
  pending = setTimeout(() => {
    mkdirSync(DIR, { recursive: true });
    const tmp = new URL("state.json.tmp", DIR);
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, FILE);
  }, 200);
}
