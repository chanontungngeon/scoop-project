export type Event = {
  id: string;
  title_en: string;
  title_th: string;
  description_short_en: string;
  description_short_th: string;
  category: string;
  start_datetime: string;
  end_datetime: string;
  price_thb_min: number;
  price_thb_max: number;
  seats_remaining: number;
  status: string;
  venue: {
    name_en: string;
    name_th: string;
    area: string;
    lat: number;
    lng: number;
    phone?: string | null;
    contact_person?: string | null; // filled in by venue partners; public data has no staff names
    website?: string | null;
    youtube_url?: string | null; // a hand-picked review video; otherwise Scoop links to a YouTube search
    venue_type?: "business" | "public"; // a shop, restaurant, gym ... or a park, market, museum ...
    activity?: string; // sports venues: what you go there for, e.g. "tennis", "climbing"
    // What OpenStreetMap knows about the place, when it knows it.
    info?: {
      opening_hours?: string;
      address?: string;
      email?: string;
      facebook?: string;
      instagram?: string;
      wheelchair?: string;
      cuisine?: string[];
      wikipedia?: string;
      description?: string;
    };
  };
  // Sports events: what you'll be doing, e.g. "tennis", "muay_thai". From the event's title, else its venue.
  activity?: string;
  // "required": book a spot (businesses, and programmes like tours and classes). "walk_in": no reservation, just
  // turn up; Scoop adds it to the user's calendar instead of booking.
  booking?: "required" | "walk_in";
  transit_en: string;
  transit_th: string;
  image_url: string;
  // Guided activities (market walks, tours, curator viewings): what the guide includes and where to meet.
  guide?: {
    type: string;
    duration_min: number;
    includes_en: string;
    includes_th: string;
    meeting_point_en: string;
    meeting_point_th: string;
    languages: string;
  };
  image_path?: string; // local copy under assets/, served at /assets
  image_credit?: string;
  image_source?: string;
};

export type Filter = {
  // ISO datetimes with offset. null means unbounded on that side.
  date_range: { start: string | null; end: string | null };
  price_max_thb: number | null;
  categories: string[];
  party_size: number | null;
  activities?: string[]; // sports activities, e.g. ["tennis", "wakeboard"]; unset or empty means any
};

export type Constraint = "date" | "category" | "price" | "party_size";

const t = (iso: string) => Date.parse(iso);

// An event matches the window if any part of it overlaps the window.
const inDateRange = (e: Event, f: Filter) =>
  (f.date_range.start === null || t(e.end_datetime) > t(f.date_range.start)) &&
  (f.date_range.end === null || t(e.start_datetime) < t(f.date_range.end));

// The kind of event, and for sports what it is (tennis, climbing ...). Both count as the "category" constraint.
const inCategory = (e: Event, f: Filter) =>
  (f.categories.length === 0 || f.categories.includes(e.category)) &&
  (!f.activities?.length || f.activities.includes(e.activity ?? ""));

const inBudget = (e: Event, f: Filter) => f.price_max_thb === null || e.price_thb_min <= f.price_max_thb;

const hasSeats = (e: Event, f: Filter) => e.seats_remaining >= Math.max(1, f.party_size ?? 1);

const CHECKS: Record<Constraint, (e: Event, f: Filter) => boolean> = {
  date: inDateRange,
  category: inCategory,
  price: inBudget,
  party_size: hasSeats,
};

function matching(events: Event[], f: Filter, skip?: Constraint): Event[] {
  return events.filter(
    (e) =>
      e.status === "active" &&
      e.seats_remaining > 0 &&
      (Object.keys(CHECKS) as Constraint[]).every((c) => c === skip || CHECKS[c](e, f)),
  );
}

export function filterEvents(events: Event[], f: Filter, limit = 3): Event[] {
  return matching(events, f)
    .sort((a, b) => t(a.start_datetime) - t(b.start_datetime))
    .slice(0, limit);
}

// For an empty result: the first constraint that, if dropped on its own, would
// produce results. Falls back to "date" when no single constraint is to blame.
export function blockingConstraint(events: Event[], f: Filter): Constraint {
  const order: Constraint[] = ["party_size", "price", "category", "date"];
  return order.find((c) => matching(events, f, c).length > 0) ?? "date";
}
