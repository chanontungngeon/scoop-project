// Grows scoop-mock-data-bkk.json from 500 to 1000 events by adding mock events at real venues from scoop-venues-bkk.json,
// and gives every event (old and new) its booking type and what's known about its venue.
//
// New events copy the style of an existing event held at the same type of venue (title, description, clock times,
// price, guide, photo), with a new venue, day, price, seats and status. Sports events are matched to what the venue
// is for: a tennis club gets tennis, a wake park gets wakeboarding (SPORTS below, photos from fetch-sport-photos.mjs).
// Venues no event uses yet are filled first.
//
// booking: "required" for anything at a business (shop, restaurant, bar, gym, studio, cinema ...), for food events,
// and for programmes anywhere (tours, classes, workshops, sessions ...); "walk_in" for everything else at a public place (exhibitions,
// fairs, markets, run clubs ...): no reservation, the user just adds it to their calendar.
//
// The eval_set in the JSON must give the same answers afterwards, so an event that would change one is moved to
// another day. Re-running rebuilds e501 onwards from scratch and gives the same result (fixed random seed).
//   node scripts/events/generate-more.ts
import { readFileSync, writeFileSync } from "node:fs";
import { blockingConstraint, filterEvents } from "../../src/filter.ts";
import type { Event, Filter } from "../../src/filter.ts";

type Venue = {
  id: string; category: string; name_en: string; name_th: string; lat: number; lng: number;
  phone: string | null; website: string | null; google_maps_url?: string; opening_hours?: string | null; address?: string | null;
  activity?: string; venue_type: "business" | "public"; details: Record<string, unknown>;
  nearest_station: { name_en: string }; transit_en: string; transit_th: string;
};
type StoredEvent = Event & { venue: Event["venue"] & { venue_id?: string; google_maps_url?: string } };
type EvalCase = { id: string; filter: Filter; expected_ids: string[] };
type Photo = { image_path: string; image_url: string; image_credit: string; image_source: string };

const TOTAL = 1000;
const FIRST_DAY = "2026-09-14"; // 13 Sep is left as it is: the "tonight, party of 6" eval case is about that evening
const LAST_DAY = "2026-10-04";
// Kinds of the 500 new events: more sports than the first 500 had, now that there are sports activity venues.
const MIX: Record<string, number> = { sports: 150, food: 90, art: 80, market: 70, nightlife: 30, music: 30, workshop: 22, film: 16, comedy: 12 };
// Which venue categories each kind of event can be held at (as in the first 500).
const VENUE_KINDS: Record<string, string[]> = { food: ["food", "market"], art: ["art"], sports: ["sports"], market: ["market"], nightlife: ["nightlife"], music: ["music", "nightlife"], workshop: ["workshop"], film: ["film"], comedy: ["comedy"] };

// Sports activities the first 500 events don't cover. program: a class, lesson or organised session you sign up for.
// where: only at public places (a kickabout on the public pitch) or only at businesses; unset means either.
type SportTemplate = { title_en: string; title_th: string; description_short_en: string; description_short_th: string; start: string; minutes: number; price: number; seats: number; program: boolean; where?: "public" | "business" };
const S = (title_en: string, title_th: string, description_short_en: string, description_short_th: string, start: string, minutes: number, price: number, seats: number, program = true, where?: "public" | "business"): SportTemplate =>
  ({ title_en, title_th, description_short_en, description_short_th, start, minutes, price, seats, program, where });
const SPORTS: Record<string, SportTemplate[]> = {
  tennis: [
    S("Social Tennis Doubles", "ตีเทนนิสคู่ หาเพื่อนใหม่", "Rotate partners for friendly doubles, all levels welcome.", "สลับคู่ตีสนุกๆ ทุกระดับร่วมได้", "18:30", 120, 350, 16),
    S("Beginner Tennis Clinic", "คลินิกเทนนิสมือใหม่", "Coach-led basics: grip, forehand and serve. Rackets provided.", "โค้ชสอนพื้นฐาน จับไม้ โฟร์แฮนด์ เสิร์ฟ มีไม้ให้ยืม", "09:00", 90, 600, 8),
  ],
  wakeboard: [
    S("Beginner Cable Wakeboard Session", "เวคบอร์ดมือใหม่กับสายเคเบิล", "Kneeboard warm-up, then your first rides on the cable with an instructor. Board and vest included.", "วอร์มด้วยนีบอร์ด แล้วลองเล่นบนสายเคเบิลกับครูฝึก รวมบอร์ดและเสื้อชูชีพ", "10:00", 180, 1200, 10),
    S("Sunset Wake Session", "เล่นเวคบอร์ดยามเย็น", "A two-hour cable pass for riders who can already get up.", "บัตรเล่น 2 ชั่วโมง สำหรับคนที่ลุกยืนบนบอร์ดได้แล้ว", "16:00", 120, 900, 20),
  ],
  climbing: [
    S("Intro to Bouldering", "ปีนผามือใหม่ (โบลเดอริ่ง)", "Learn footwork and how to fall safely on beginner walls. Shoes included.", "เรียนการวางเท้าและการตกอย่างปลอดภัยบนผนังมือใหม่ รวมรองเท้า", "19:00", 90, 650, 10),
    S("Climbing Social Night", "คืนปีนผาชวนเพื่อนใหม่", "New problems set for the night, climb in small groups, drinks after. Day pass included.", "เซ็ตเส้นทางใหม่ ปีนเป็นกลุ่มเล็ก คุยกันต่อหลังปีน รวมบัตรรายวัน", "19:30", 120, 450, 24),
  ],
  padel: [
    S("Padel Americano Mixer", "แพเดิลอเมริกาโน่ สลับคู่", "Short matches with a new partner every round. Rackets for rent.", "แมตช์สั้นๆ เปลี่ยนคู่ทุกรอบ มีไม้ให้เช่า", "19:00", 120, 550, 16),
    S("Padel Taster Lesson", "ลองเล่นแพเดิลครั้งแรก", "One hour with a coach to learn the walls, the serve and the scoring.", "เรียนกับโค้ช 1 ชั่วโมง การใช้กำแพง การเสิร์ฟ และการนับแต้ม", "10:00", 60, 700, 4),
  ],
  badminton: [
    S("Badminton Doubles Meetup", "นัดตีแบดคู่", "Casual doubles, courts and shuttles shared. Intermediate players welcome.", "ตีคู่ชิลๆ แชร์คอร์ตและลูก ระดับกลางร่วมได้", "19:00", 120, 180, 16),
    S("Badminton Skills Clinic", "คลินิกทักษะแบดมินตัน", "Footwork and smash drills with a coach, then games.", "ฝึกฟุตเวิร์กและการตบกับโค้ช แล้วลงเล่นจริง", "10:00", 90, 400, 12),
  ],
  swimming: [
    S("Adult Learn-to-Swim", "เรียนว่ายน้ำสำหรับผู้ใหญ่", "Small-group lesson for adults who never learned: breathing, floating and freestyle.", "คลาสกลุ่มเล็กสำหรับผู้ใหญ่ที่ยังว่ายไม่เป็น การหายใจ ลอยตัว และฟรีสไตล์", "07:30", 60, 500, 6),
    S("Open Lane Swim Morning", "ว่ายน้ำเช้า เลนเปิด", "Lap lanes open to everyone; pay at the pool.", "เลนว่ายเปิดให้ทุกคน จ่ายที่สระ", "06:30", 90, 100, 60, false),
  ],
  golf: [
    S("Driving Range Night: Fix Your Swing", "คืนไดร์ฟกอล์ฟ ปรับวงสวิง", "A pro checks your swing on the range; 100 balls included.", "โปรช่วยดูวงสวิงที่สนามไดร์ฟ รวมลูก 100 ลูก", "18:30", 90, 800, 10),
    S("Golf for Beginners", "กอล์ฟสำหรับมือใหม่", "Grip, stance and short game with a coach. Clubs provided.", "เรียนการจับ ท่ายืน และลูกสั้นกับโค้ช มีไม้ให้ยืม", "09:00", 120, 1500, 6),
  ],
  skate: [
    S("Skatepark Jam Session", "แจมสเก็ตบอร์ดที่ลานสเก็ต", "Bring your board: all ages and levels, music on, just turn up.", "ถือบอร์ดมาเลย ทุกวัยทุกระดับ มีเพลง มาได้เลย", "16:30", 150, 0, 80, false, "public"),
    S("Beginner Skate Lesson", "เรียนสเก็ตบอร์ดมือใหม่", "Balance, pushing and stopping with a coach. Boards and pads to borrow.", "ฝึกทรงตัว ไถ และหยุดกับโค้ช มีบอร์ดและสนับให้ยืม", "09:30", 90, 450, 8),
  ],
  bowling: [S("Glow Bowling Night", "คืนโบว์ลิ่งแสงนีออน", "Two games under blacklight with music; shoes included.", "เล่น 2 เกมใต้แสงแบล็กไลต์พร้อมเพลง รวมรองเท้า", "20:00", 120, 350, 30)],
  ice_skating: [
    S("Ice Skating Afternoon", "ไถลน้ำแข็งยามบ่าย", "Public session with skate rental. Bring gloves and warm socks.", "รอบเล่นทั่วไป มีรองเท้าสเก็ตให้เช่า พกถุงมือและถุงเท้าอุ่นๆ มาด้วย", "14:00", 120, 350, 60, false),
    S("Learn to Ice Skate", "เรียนสเก็ตน้ำแข็งเบื้องต้น", "First steps on the ice with a coach: balance, gliding and stopping.", "ก้าวแรกบนลานน้ำแข็งกับโค้ช ทรงตัว ไถล และหยุด", "10:00", 60, 600, 8),
  ],
  surfing: [S("FlowRider Surf Session", "เซิร์ฟบนคลื่นจำลอง FlowRider", "An hour on the standing wave with a coach on deck; board included.", "เล่นบนคลื่นจำลอง 1 ชั่วโมง มีโค้ชคอยช่วย รวมบอร์ด", "11:00", 60, 900, 10)],
  trampoline: [S("Trampoline Park Jump Hour", "กระโดดแทรมโพลีน 1 ชั่วโมง", "Open jump, dodgeball court and foam pit. Grip socks needed.", "กระโดดอิสระ สนามดอดจ์บอล และบ่อโฟม ต้องใส่ถุงเท้ากันลื่น", "15:00", 60, 450, 40)],
  archery: [S("Archery Taster", "ลองยิงธนูครั้งแรก", "Safety briefing, then 60 arrows with a coach.", "ฟังการสอนความปลอดภัย แล้วยิง 60 ดอกกับโค้ช", "09:00", 90, 400, 10)],
  football: [
    S("Pick-up Futsal Night", "เตะฟุตซอลขาจร", "Teams are mixed on the night, 5-a-side, bibs provided.", "จัดทีมกันหน้างาน 5 คน มีเสื้อเอี๊ยมให้", "19:30", 90, 150, 20),
    S("Sunday Football Kickabout", "เตะบอลชิลวันอาทิตย์", "Friendly kickabout on the public pitch; everyone joins in.", "เตะบอลกระชับมิตรที่สนามสาธารณะ ใครก็ร่วมได้", "08:00", 90, 0, 40, false, "public"),
  ],
  karting: [S("Go-Kart Grand Prix Night", "คืนแข่งโกคาร์ท", "Practice laps, then a 10-minute race. Helmet included.", "วิ่งซ้อม แล้วแข่งจริง 10 นาที รวมหมวกกันน็อก", "19:00", 90, 900, 12)],
  pilates: [S("Reformer Pilates Intro", "พิลาทิสรีฟอร์เมอร์ครั้งแรก", "A beginner reformer class in a small group.", "คลาสรีฟอร์เมอร์สำหรับมือใหม่ กลุ่มเล็ก", "08:00", 55, 700, 6)],
  basketball: [S("3x3 Basketball Pickup", "บาสเกตบอล 3x3 ขาจร", "Winners stay on; teams made on the night.", "ทีมชนะเล่นต่อ จัดทีมกันหน้างาน", "18:30", 120, 150, 24)],
  dance: [S("Social Dance Night: Salsa Basics", "คืนเต้นซัลซ่าเบื้องต้น", "A beginner salsa class, then social dancing. No partner needed.", "คลาสซัลซ่าเบื้องต้นแล้วเต้นกันต่อ ไม่ต้องมีคู่", "19:30", 90, 400, 30)],
  racquet: [S("Squash Social", "นัดตีสควอช", "Round-robin games for all levels; rackets for rent.", "ผลัดกันเล่นทุกระดับ มีไม้ให้เช่า", "18:30", 90, 300, 12)],
  yoga: [
    S("Sunset Yoga Flow", "โยคะโฟลว์ยามเย็น", "An all-levels vinyasa class to wind down after work. Mats provided.", "คลาสวินยาสะทุกระดับ ผ่อนคลายหลังเลิกงาน มีเสื่อให้", "18:00", 60, 350, 20),
    S("Beginner Yoga Class", "คลาสโยคะมือใหม่", "Basic poses and breathing, taught slowly for first-timers.", "ท่าพื้นฐานและการหายใจ สอนช้าๆ สำหรับครั้งแรก", "09:00", 75, 400, 16),
  ],
  muay_thai: [
    S("Muay Thai Beginner Session", "มวยไทยสำหรับมือใหม่", "Stance, kicks and pad work with a trainer. Gloves and wraps provided.", "ท่ายืน การเตะ และซ้อมเป้ากับครูมวย มีนวมและผ้าพันมือให้", "10:00", 90, 500, 12),
    S("Muay Thai Fitness Session", "คลาสมวยไทยฟิตเนส", "A sweaty hour of Muay Thai-style cardio, no sparring.", "คาร์ดิโอสไตล์มวยไทย 1 ชั่วโมง ไม่มีการปะทะ", "18:00", 60, 400, 20),
  ],
  fitness: [
    S("HIIT Bootcamp Class", "คลาส HIIT บูทแคมป์", "45 minutes of intervals in a small group, all levels scaled.", "คลาสอินเทอร์วัล 45 นาทีกลุ่มเล็ก ปรับตามระดับได้", "07:00", 45, 450, 16),
    S("Strength Training Intro", "เริ่มต้นเวทเทรนนิ่ง", "A coach shows you the main lifts and builds you a simple plan.", "โค้ชสอนท่ายกหลักและวางแผนฝึกง่ายๆ ให้", "18:30", 60, 600, 8),
  ],
  sports_ground: [
    S("Community Run Club", "ชมรมวิ่งชุมชน", "An easy 5 km loop, all paces welcome, just turn up.", "วิ่งสบาย 5 กม. ทุกเพซร่วมได้ มาได้เลย", "06:00", 90, 0, 80, false, "public"),
    S("Track Session: Intervals", "ซ้อมวิ่งลู่ อินเทอร์วัล", "Coached 400 m repeats on the track for runners who want to get faster.", "โค้ชคุมซ้อมวิ่ง 400 เมตร สำหรับคนที่อยากวิ่งเร็วขึ้น", "18:00", 75, 200, 30),
    S("Weekend Tournament", "ทัวร์นาเมนต์สุดสัปดาห์", "Sign up as a team or on your own and get placed in one.", "สมัครเป็นทีมหรือมาคนเดียวแล้วจัดทีมให้", "09:00", 360, 300, 60),
  ],
  table_tennis: [S("Table Tennis Club Night", "คืนปิงปองชมรม", "Open tables and friendly matches; bats to borrow.", "เปิดโต๊ะให้เล่นและแข่งกันแบบเป็นกันเอง มีไม้ให้ยืม", "19:00", 120, 100, 20)],
};

// A programme needs booking even at a public place: tours, walks, classes, sessions, tournaments, ticketed shows.
const PROGRAMME = /tour|walk\b|walk:|walkthrough|crawl|workshop|class|lesson|clinic|(?<!acoustic )session|tournament|pickup|kayak|life drawing|taster|intro to|beginner|comedy|disco|cinema|techno|guided|meet-the-makers|beer tasting/i;
const PUBLIC_WITHOUT_ID = /park|lumpini|benjakitti|stadium|market|museum|gallery|bacc|chatuchak/i; // e01–e29 have no venue record

const dataFile = new URL("../../scoop-mock-data-bkk.json", import.meta.url);
const data = JSON.parse(readFileSync(dataFile, "utf8")) as { meta: Record<string, string>; events: StoredEvent[]; eval_set: EvalCase[] };
const venues = (JSON.parse(readFileSync(new URL("../../scoop-venues-bkk.json", import.meta.url), "utf8")) as { venues: Venue[] }).venues;
const venueById = new Map(venues.map((v) => [v.id, v]));
const photos = JSON.parse(readFileSync(new URL("../../assets/events/sport-photos.json", import.meta.url), "utf8")) as Record<string, Photo[]>;

// Deterministic random numbers, so the file only changes when this script does.
let seed = 20260914;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

// What an event carries about its venue, from the venue record (e01–e29 have none and keep what they have).
function venueFields(e: StoredEvent, v: Venue | undefined): Partial<Event["venue"]> {
  const venueType = v?.venue_type ?? (["market", "art"].includes(e.category) || (e.category === "sports" && PUBLIC_WITHOUT_ID.test(e.venue.name_en)) ? "public" : "business");
  if (!v) return { venue_type: venueType };
  const d = v.details as Record<string, string | string[] | undefined>;
  const info = { opening_hours: v.opening_hours ?? undefined, address: v.address ?? undefined, email: d.email, facebook: d.facebook, instagram: d.instagram, wheelchair: d.wheelchair, cuisine: d.cuisine, wikipedia: d.wikipedia, description: d.description };
  return {
    venue_type: venueType,
    ...(v.activity ? { activity: v.activity } : {}),
    info: Object.fromEntries(Object.entries(info).filter(([, x]) => x !== undefined && x !== null)) as Event["venue"]["info"],
  };
}
// A sports event's activity comes from its title when that names one ("Muay Thai Fitness Session"), since some original
// events sit at a venue made for something else; otherwise from the venue.
const TITLE_ACTIVITY: [RegExp, string][] = [
  [/muay|boxing/i, "muay_thai"], [/yoga/i, "yoga"], [/pilates/i, "pilates"], [/run\b|running|track session/i, "running"], [/tennis/i, "tennis"],
  [/badminton/i, "badminton"], [/futsal|football|five-a-side/i, "football"], [/kayak|sup\b|paddle/i, "paddling"], [/swim/i, "swimming"],
  [/boulder|climb/i, "climbing"], [/wake/i, "wakeboard"], [/padel/i, "padel"], [/golf|driving range/i, "golf"], [/skate/i, "skate"],
  [/bowling/i, "bowling"], [/ice skat/i, "ice_skating"], [/surf|flowrider/i, "surfing"], [/trampoline/i, "trampoline"], [/archery/i, "archery"],
  [/kart/i, "karting"], [/basketball/i, "basketball"], [/salsa|dance/i, "dance"], [/squash/i, "racquet"], [/table tennis/i, "table_tennis"],
  [/hiit|bootcamp|strength|fitness/i, "fitness"],
];
const activityOf = (e: StoredEvent) => (e.category !== "sports" ? undefined : TITLE_ACTIVITY.find(([re]) => re.test(e.title_en))?.[1] ?? e.venue.activity);

const bookingOf = (e: StoredEvent, program?: boolean): Event["booking"] =>
  e.venue.venue_type === "business" || e.guide || e.category === "workshop" || e.category === "food" || (program ?? PROGRAMME.test(e.title_en)) ? "required" : "walk_in";

const base = data.events.filter((e) => Number(e.id.slice(1)) <= 500);
for (const e of base) {
  Object.assign(e.venue, venueFields(e, venueById.get(e.venue.venue_id ?? "")));
  if (!e.venue.info || !Object.keys(e.venue.info).length) delete e.venue.info;
  e.booking = bookingOf(e);
  if (activityOf(e)) e.activity = activityOf(e); else delete e.activity;
}

// Only titles that can move: generic ones used at two or more venues ("Quiz Night"), or ones naming their own venue,
// which gets swapped for the new one. A title naming another place ("Benjakitti Skywalk Morning Run") stays put.
const venuesPerTitle = new Map<string, Set<string>>();
for (const e of base) venuesPerTitle.set(e.title_en, (venuesPerTitle.get(e.title_en) ?? new Set()).add(e.venue.name_en));
const templates = base.filter((e) => e.venue.venue_id && venueById.has(e.venue.venue_id) && (venuesPerTitle.get(e.title_en)!.size >= 2 || e.title_en.includes(e.venue.name_en)));

const days: string[] = [];
for (let d = new Date(`${FIRST_DAY}T12:00:00+07:00`); d <= new Date(`${LAST_DAY}T12:00:00+07:00`); d = new Date(d.getTime() + 86400000)) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
  const weekend = [0, 5, 6].includes(new Date(`${iso}T12:00:00+07:00`).getUTCDay()); // Fri–Sun are busier
  days.push(...(weekend ? [iso, iso] : [iso]));
}

// A title that names a day keeps to it, as in the first 500: "Weekend Tournament" and brunches on Saturday or Sunday.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+07:00`).getUTCDay()];
function daysFor(title: string): string[] {
  const t = title.toLowerCase();
  const named = WEEKDAYS.filter((w) => t.includes(w));
  const allowed = named.length ? named : /weekend|brunch/.test(t) ? ["saturday", "sunday"] : WEEKDAYS;
  return days.filter((d) => allowed.includes(weekdayOf(d)));
}

const uses = new Map<string, number>();
for (const e of base) if (e.venue.venue_id) uses.set(e.venue.venue_id, (uses.get(e.venue.venue_id) ?? 0) + 1);
function chooseVenue(kind: string): Venue {
  const pool = venues.filter((v) => VENUE_KINDS[kind].includes(v.category));
  const least = Math.min(...pool.map((v) => uses.get(v.id) ?? 0));
  const v = pick(pool.filter((p) => (uses.get(p.id) ?? 0) === least));
  uses.set(v.id, (uses.get(v.id) ?? 0) + 1);
  return v;
}

const swap = (text: string, from: string, to: string) => (from && text.includes(from) ? text.split(from).join(to) : text);
const roundTo = (n: number, step: number) => Math.max(0, Math.round(n / step) * step);
const nextDay = (day: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(new Date(`${day}T12:00:00+07:00`).getTime() + 86400000));
const seatsLike = (typical: number) => { const r = rand(); return r < 0.06 ? 0 : r < 0.18 ? 1 + Math.floor(rand() * 4) : Math.max(5, Math.round(typical * (0.5 + rand()))); };

function atVenue(e: StoredEvent, v: Venue): StoredEvent["venue"] {
  return {
    venue_id: v.id, name_en: v.name_en, name_th: v.name_th, area: v.nearest_station.name_en, lat: v.lat, lng: v.lng,
    phone: v.phone, contact_person: null, website: v.website,
    google_maps_url: v.google_maps_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name_en}, ${v.nearest_station.name_en}, Bangkok`)}`,
    ...venueFields(e, v),
  };
}

function fromTemplate(id: string, t: StoredEvent, v: Venue, day: string): StoredEvent {
  const clock = (iso: string) => iso.slice(10); // "T19:00:00+07:00"
  const endsNextDay = t.end_datetime.slice(0, 10) > t.start_datetime.slice(0, 10);
  const scale = 0.8 + rand() * 0.5;
  const priceMin = t.price_thb_min === 0 ? 0 : roundTo(t.price_thb_min * scale, 10);
  const oldV = t.venue;
  const e: StoredEvent = {
    ...t,
    id,
    title_en: swap(t.title_en, oldV.name_en, v.name_en),
    title_th: swap(swap(t.title_th, oldV.name_th, v.name_th), oldV.name_en, v.name_th),
    start_datetime: `${day}${clock(t.start_datetime)}`,
    end_datetime: `${endsNextDay ? nextDay(day) : day}${clock(t.end_datetime)}`,
    price_thb_min: priceMin,
    price_thb_max: t.price_thb_max === 0 ? 0 : Math.max(priceMin, roundTo(t.price_thb_max * scale, 10)),
    seats_remaining: seatsLike(t.seats_remaining),
    status: rand() < 0.05 ? "cancelled" : "active",
    transit_en: v.transit_en,
    transit_th: v.transit_th,
  };
  e.venue = atVenue(e, v);
  if (t.guide) {
    e.guide = {
      ...t.guide,
      meeting_point_en: swap(t.guide.meeting_point_en, oldV.name_en, v.name_en),
      meeting_point_th: swap(swap(t.guide.meeting_point_th, oldV.name_th, v.name_th), oldV.name_en, v.name_th),
    };
  }
  e.booking = bookingOf(e);
  if (activityOf(e)) e.activity = activityOf(e); else delete e.activity;
  return e;
}

function fromSport(id: string, s: SportTemplate, v: Venue, day: string): StoredEvent {
  const [h, m] = s.start.split(":").map(Number);
  const endMin = h * 60 + m + s.minutes;
  const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const price = s.price === 0 ? 0 : roundTo(s.price * (0.8 + rand() * 0.5), 10);
  const activity = SPORTS[v.activity!]?.includes(s) ? v.activity! : Object.keys(SPORTS).find((k) => SPORTS[k].includes(s))!;
  const photo = pick(photos[activity]);
  const e = {
    id, title_en: s.title_en, title_th: s.title_th, description_short_en: s.description_short_en, description_short_th: s.description_short_th,
    category: "sports",
    start_datetime: `${day}T${s.start}:00+07:00`,
    end_datetime: `${endMin >= 24 * 60 ? nextDay(day) : day}T${hhmm(endMin)}:00+07:00`,
    price_thb_min: price, price_thb_max: price,
    seats_remaining: seatsLike(s.seats),
    status: rand() < 0.05 ? "cancelled" : "active",
    transit_en: v.transit_en, transit_th: v.transit_th,
    ...photo,
  } as StoredEvent;
  e.venue = atVenue(e, v);
  e.booking = bookingOf(e, s.program);
  e.activity = activity === "sports_ground" ? activityOf(e) ?? "sports_ground" : activity;
  return e;
}

// Same results for every case, and for the empty ones the same "which filter blocked it" as the first 500 give.
const blockedBy = new Map(data.eval_set.filter((c) => c.expected_ids.length === 0).map((c) => [c.id, blockingConstraint(base, c.filter)]));
const evalsUnchanged = (events: Event[]) =>
  data.eval_set.every((c) => JSON.stringify(filterEvents(events, c.filter).map((e) => e.id)) === JSON.stringify(c.expected_ids)) &&
  [...blockedBy].every(([id, constraint]) => blockingConstraint(events, data.eval_set.find((c) => c.id === id)!.filter) === constraint);
if (!evalsUnchanged(base)) throw new Error("eval_set already fails on the first 500 events; fix that first");

const events: StoredEvent[] = [...base];
const kinds = Object.entries(MIX).flatMap(([k, n]) => Array<string>(n).fill(k)).sort(() => rand() - 0.5);
let moved = 0;
kinds.slice(0, TOTAL - base.length).forEach((kind, i) => {
  const id = `e${base.length + i + 1}`;
  const v = chooseVenue(kind);
  // Sports: an event made for what the venue is for, from SPORTS or an original event at the same kind of venue.
  // Everything else: modelled on an event held at the same type of venue, so a wine pairing doesn't land in a market.
  // (Original sports events aren't reused: some of them sit at the wrong kind of venue, like yoga at a badminton hall.)
  const fits = (s: SportTemplate) => !s.where || s.where === v.venue_type;
  const sportOptions = (kind === "sports" && photos[v.activity!]?.length ? SPORTS[v.activity!] ?? [] : []).filter(fits);
  const generalSports = (kind === "sports" ? [...SPORTS.fitness, ...SPORTS.sports_ground] : []).filter(fits);
  const sameVenueType = templates.filter((x) => x.category === kind && venueById.get(x.venue.venue_id!)!.category === v.category);
  const pool: (StoredEvent | SportTemplate)[] = kind === "sports" ? (sportOptions.length ? sportOptions : generalSports) : sameVenueType.length ? sameVenueType : templates.filter((x) => x.category === kind);
  const t = pick(pool);
  const make = (day: string) => ("id" in t ? fromTemplate(id, t, v, day) : fromSport(id, t, v, day));
  const allowedDays = daysFor(t.title_en);
  for (let attempt = 0; ; attempt++) {
    const e = make(pick(allowedDays));
    if (evalsUnchanged([...events, e])) { events.push(e); break; }
    moved++;
    if (attempt > 50) throw new Error(`no day fits ${id} without changing eval_set`);
  }
});

data.events = events;
data.meta.note = "Mock data. Dates cover 2026-09-13 to 2026-10-04. e01-e29 are fully mock; e30+ are mock events placed at real venues from scoop-venues-bkk.json (location, phone, website, opening hours and more, nearest station © OpenStreetMap contributors, ODbL) - venue.venue_id links back to that file and venue.google_maps_url opens a Google Maps search for the venue. Event titles, times, prices and seats are invented. e501-e1000 were added by scripts/events/generate-more.ts. booking is 'required' at businesses and for programmes, 'walk_in' otherwise (no reservation, add to calendar).";
data.meta.images_note = "image_path is a 640px copy in assets/events/ served by the bot at /assets; image_url is the original Wikimedia Commons thumbnail. e501+ reuse the photo of the event they were modelled on, or a sports photo from assets/events/sport-photos.json. Every photo is CC BY / CC BY-SA / CC0 / public domain - image_credit and image_source give the author and licence page.";
writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");

const count = <T extends string>(xs: T[]) => xs.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {} as Record<string, number>);
const added = events.slice(base.length);
const used = new Set(events.map((e) => e.venue.venue_id).filter(Boolean));
console.log(`events: ${events.length} (added ${added.length}: ${JSON.stringify(count(added.map((e) => e.category)))})`);
console.log(`sports activities in new events: ${JSON.stringify(count(added.filter((e) => e.category === "sports").map((e) => e.venue.activity ?? "?")))}`);
console.log(`booking: ${JSON.stringify(count(events.map((e) => e.booking!)))} · venues with an event: ${used.size} of ${venues.length} · cancelled: ${events.filter((e) => e.status === "cancelled").length} · moved to keep eval_set: ${moved}`);
