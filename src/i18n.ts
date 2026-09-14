export type Lang = "th" | "en" | "zh" | "hi";

export const LANGS: { id: Lang; flag: string; name: string; locale: string }[] = [
  { id: "th", flag: "🇹🇭", name: "ไทย", locale: "th-TH-u-ca-gregory" },
  { id: "en", flag: "🇬🇧", name: "English", locale: "en-GB" },
  { id: "zh", flag: "🇨🇳", name: "中文", locale: "zh-CN" },
  { id: "hi", flag: "🇮🇳", name: "हिन्दी", locale: "hi-IN" },
];

export const isLang = (s: string | null | undefined): s is Lang => LANGS.some((l) => l.id === s);
export const localeOf = (lang: Lang) => LANGS.find((l) => l.id === lang)!.locale;

// Reply in the script the user is typing in; fall back to the language they picked.
export function detectLang(text: string): Lang | null {
  if (/[฀-๿]/.test(text)) return "th";
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  return null;
}

// Shown before we know the user's language.
export const GREETING =
  "สวัสดี! เราคือ Scoop 🔍 เพื่อนหาอะไรสนุกๆ ทำในกรุงเทพฯ ช่วยหางาน จองในแชท และบอกทางไปให้ด้วย\n\n" +
  "Hi! I'm Scoop 🔍 your Bangkok buddy. I find fun things to do, book them in this chat and help you get there.\n\n" +
  "你好！我是 Scoop 🔍 你的曼谷玩乐伙伴：帮你找好玩的活动、在聊天里预订，还告诉你怎么去。\n\n" +
  "नमस्ते! मैं Scoop हूँ 🔍 बैंकॉक में आपका साथी: मज़ेदार चीज़ें ढूँढता हूँ, चैट में बुक करता हूँ और वहाँ पहुँचने में मदद करता हूँ।";

export const CHOOSE_LANGUAGE = "เลือกภาษา · Choose your language · 选择语言 · भाषा चुनें";

type Strings = {
  welcome: string; // shown right after choosing a language: who Scoop is, how it helps, how to talk to it
  nextTrip: string; // after a booking, when the user says something that isn't a search
  pickVibe: string;
  vibeChosen: (vibe: string) => string;
  changeVibe: string;
  language: string;
  help: string;
  examples: [label: string, text: string][];
  found: (n: number, vibe: string | null) => string;
  noMatch: string;
  noMatchTail: string;
  reasonParty: (w: string, n: number) => string;
  reasonPrice: (w: string, budget: string) => string;
  reasonCategory: (w: string, cats: string) => string;
  reasonDate: (w: string) => string;
  free: string;
  spotsLeft: (n: number) => string;
  book: string;
  map: string;
  seeAllOnMap: (n: number) => string;
  openMap: string;
  booked: string;
  bookedAlt: (title: string) => string;
  when: string;
  where: string;
  price: string;
  code: string;
  ticketUnit: string;
  demoNote: string;
  full: string;
  reminderSet: (title: string, at: string) => string;
  addToCalendar: string;
  openingApp: (app: string) => string;
  openApp: (app: string) => string;
  copyAndOpen: (app: string) => string;
  backToLine: string;
  guideMeet: string;
  watchReview: string;
  guideMinutes: (n: number) => string;
  transitTitle: string;
  transitSummary: (min: number, fare: number) => string;
  walkTo: (min: number, place: string) => string;
  rideLine: (line: string, towards: string, stops: number, to: string, min: number) => string;
  changeAt: (station: string, min: number) => string;
  walkOnly: (min: number) => string;
  transitNote: string;
  transitMaps: string;
  noTransit: string;
  lineName: Record<string, string>;
  pasteHint: (app: string) => string;
  noApp: (app: string) => string;
  destinationL: string;
  copyDestination: string;
  copied: string;
  callVenue: string;
  phoneL: string;
  contactL: string;
  reminder: string;
  bookingCode: string;
  sorry: string;
  mapHeader: (n: number) => string;
  directions: string;
  altFound: (n: number) => string;
  ride: string;
  shareLocation: string;
  shareLocationBtn: string;
  rideTitle: string;
  to: string;
  distance: string;
  travelTime: string;
  taxiFare: string;
  appFare: string;
  leaveBy: string;
  km: string;
  min: string;
  leaveNow: string;
  estimateNote: string;
  openGrab: string;
  openLineman: string;
  remindLeave: string;
  leaveReminderSet: (time: string, demoSeconds: number | null) => string;
  timeToLeave: (title: string) => string;
  bookFirst: string;
};

export const T: Record<Lang, Strings> = {
  th: {
    welcome: "เยี่ยมเลย! 👋 เราคือ Scoop เพื่อนคนกรุงเทพฯ ที่ช่วยหาอะไรสนุกๆ ทำ\n\nช่วยอะไรได้บ้าง:\n🔎 หางานจริงตามวัน งบ และจำนวนคน\n🎟️ จองที่ได้ในแชทนี้เลย\n🚇 บอกทางไปงาน ทั้งรถไฟฟ้าและแท็กซี่\n🔔 เตือนก่อนงานเริ่ม\n\nคุยกับเราเหมือนคุยกับเพื่อนได้เลย เช่น “เสาร์นี้มีอะไรทำ ไปกัน 2 คน งบ 500”",
    nextTrip: "จองเรียบร้อยแล้ว 🎉\nอยากไปเที่ยวไหนต่อ หรือจะเรียกรถไปงาน? เลือกได้เลย 👇",
    pickVibe: "ก่อนอื่น เป็นสายไหน? เลือกเลย 👇",
    vibeChosen: (v) => `ชอบเลย! ${v} ในกรุงเทพฯ 🌆\nอยากหาอะไรทำ? พิมพ์มาได้เลย เช่น วัน งบ หรือไปกี่คน`,
    changeVibe: "🎭 เปลี่ยนสาย",
    language: "🌐 ภาษา",
    help: "ลองพิมพ์แบบนี้ดูนะ:\n• หาอะไรทำเสาร์นี้ งบไม่เกิน 500\n• เวิร์กช็อปฟรีสัปดาห์นี้\n• ไปกับเพื่อน 4 คน คืนนี้",
    examples: [
      ["เสาร์นี้ งบ ≤ ฿500", "หาอะไรทำเสาร์นี้ งบไม่เกิน 500"],
      ["ของฟรีสัปดาห์นี้", "มีอะไรฟรีสัปดาห์นี้"],
      ["6 คน คืนนี้", "ไปกับเพื่อน 6 คน คืนนี้"],
    ],
    found: (n, v) => `เจอ ${n} งานที่ใช่${v ? `สำหรับ ${v}` : ""}! ปัดดูได้เลย 👉`,
    noMatch: "😕 ไม่เจอเลย",
    noMatchTail: "Scoop แนะนำเฉพาะงานที่มีอยู่จริง ลองเปลี่ยนวัน งบ หรือจำนวนคนดูนะ",
    reasonParty: (w, n) => `ช่วง ${w} ไม่มีกิจกรรมที่ยังเหลือที่ว่างพอสำหรับ ${n} คน`,
    reasonPrice: (w, b) => `ช่วง ${w} ไม่มีกิจกรรมที่ราคาไม่เกินงบ (${b})`,
    reasonCategory: (w, c) => `ช่วง ${w} ไม่มีกิจกรรมประเภท ${c}`,
    reasonDate: (w) => `ช่วง ${w} ไม่มีกิจกรรมที่ตรงกับที่ขอ`,
    free: "ฟรี",
    spotsLeft: (n) => `เหลือ ${n} ที่`,
    book: "จองเลย",
    map: "ดูแผนที่",
    seeAllOnMap: (n) => `ดูทั้ง ${n} งานบนแผนที่`,
    openMap: "เปิดแผนที่",
    booked: "จองสำเร็จ!",
    bookedAlt: (t) => `จองแล้ว: ${t}`,
    when: "เวลา",
    where: "สถานที่",
    price: "ราคา",
    code: "รหัส",
    ticketUnit: "ที่",
    demoNote: "การจองตัวอย่างสำหรับเดโม — ยังไม่มีการชำระเงิน",
    full: "ขอโทษนะ งานนี้เต็มหรือปิดรับจองแล้ว 😢 ลองหางานอื่นดู",
    reminderSet: (t, at) => `🔔 ตั้งเตือนแล้ว! Scoop จะทักไปวันงาน · ${at}\nเพิ่มลง Google Calendar ได้จากปุ่มบนตั๋วเลย\nเจอกันที่ ${t} นะ 🥳`,
    addToCalendar: "📅 เพิ่มลง Google Calendar",
    openingApp: (a) => `กำลังเปิด ${a}…`,
    openApp: (a) => `เปิดแอป ${a}`,
    copyAndOpen: (a) => `📋 คัดลอกปลายทาง แล้วเปิด ${a}`,
    backToLine: "↩️ กลับไปที่ LINE",
    guideMeet: "นัดพบ",
    watchReview: "▶️ รีวิว",
    guideMinutes: (n) => `~${n} นาที`,
    transitTitle: "🚆 ไปด้วย BTS / MRT",
    transitSummary: (m, f) => `⏱️ ~${m} นาที · 💰 ~฿${f}`,
    walkTo: (m, p) => `เดิน ${m} นาที ไป ${p}`,
    rideLine: (l, t, s, to, m) => `${l} มุ่งหน้า ${t}\n${s} สถานี → ลงที่ ${to} · ~${m} นาที`,
    changeAt: (st, m) => `เปลี่ยนสายที่ ${st} · ~${m} นาที`,
    walkOnly: (m) => `ใกล้มาก! เดินไปได้เลย ~${m} นาที`,
    transitNote: "เวลาและค่าโดยสารเป็นการประมาณ · BTS กับ MRT จ่ายแยกกันเมื่อเปลี่ยนระบบ",
    transitMaps: "🗺️ ดูเส้นทางใน Google Maps",
    noTransit: "แถวนี้ไม่มีสถานี BTS / MRT ใกล้ ๆ แนะนำเรียกรถไปแทน",
    lineName: { bts_sukhumvit: "BTS สายสุขุมวิท", bts_silom: "BTS สายสีลม", mrt_blue: "MRT สายสีน้ำเงิน", mrt_purple: "MRT สายสีม่วง", mrt_yellow: "MRT สายสีเหลือง", mrt_pink: "MRT สายสีชมพู", arl: "แอร์พอร์ต เรล ลิงก์", gold: "สายสีทอง" },
    pasteHint: (a) => `ใน ${a} แตะช่อง “ไปที่ไหน” แล้ววางชื่อสถานที่ (แตะค้างแล้วเลือกวาง)`,
    noApp: (a) => `ถ้าแอป ${a} ไม่เปิด อาจยังไม่ได้ติดตั้ง ดาวน์โหลดได้ที่นี่`,
    destinationL: "ปลายทาง (คัดลอกไปวางในแอปได้)",
    copyDestination: "📋 คัดลอกปลายทาง",
    copied: "✅ คัดลอกแล้ว",
    callVenue: "📞 โทรหาร้าน",
    phoneL: "โทร",
    contactL: "ผู้ติดต่อ",
    reminder: "⏰ อย่าลืม!",
    bookingCode: "รหัสจอง",
    sorry: "ขอโทษนะ ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง",
    mapHeader: (n) => `${n} งานบนแผนที่`,
    directions: "นำทาง",
    altFound: (n) => `Scoop เจอ ${n} กิจกรรม`,
    ride: "🚕 เรียกรถไปงาน",
    shareLocation: "ส่งตำแหน่งปัจจุบันมาได้เลย 📍 Scoop จะคำนวณระยะทาง ค่ารถ และเวลาที่ควรออกเดินทางให้",
    shareLocationBtn: "📍 ส่งตำแหน่งของฉัน",
    rideTitle: "🚕 เดินทางไปงาน",
    to: "ไปที่",
    distance: "ระยะทาง",
    travelTime: "เวลาเดินทาง",
    taxiFare: "แท็กซี่มิเตอร์",
    appFare: "Grab / LINE MAN",
    leaveBy: "ควรออก",
    km: "กม.",
    min: "นาที",
    leaveNow: "ออกตอนนี้เลย",
    estimateNote: "ค่ารถและเวลาเป็นการประมาณ ราคาจริงดูในแอปตอนเรียกรถ",
    openGrab: "เปิด Grab",
    openLineman: "เปิด LINE MAN",
    remindLeave: "⏰ เตือนตอนต้องออก",
    leaveReminderSet: (t,s)=>`⏰ ตั้งเตือนแล้ว! Scoop จะทักไป${s ? `อีก ${s} วินาที (โหมดเดโม)` : `ตอน ${t}`} พร้อมปุ่มเรียกรถ`,
    timeToLeave: (title)=>`🚕 ถึงเวลาออกเดินทางไป ${title} แล้ว! เรียกรถได้เลย`,
    bookFirst: "จองงานก่อนแล้วค่อยเรียกรถนะ 😊 ลองหางานดูได้เลย",
  },
  en: {
    welcome: "Great! 👋 I'm Scoop, your Bangkok friend for finding fun things to do.\n\nHere's how I can help:\n🔎 Find real events by day, budget and group size\n🎟️ Book your spot right here in the chat\n🚇 Show you how to get there by BTS, MRT or taxi\n🔔 Remind you before it starts\n\nJust talk to me like a friend, e.g. “2 of us this Saturday, under ฿500”",
    nextTrip: "You're all booked 🎉\nWhere to next — or shall I help you get a ride there? 👇",
    pickVibe: "First — what's your vibe? Pick one 👇",
    vibeChosen: (v) => `Love it! A ${v} in Bangkok 🌆\nWhat are you looking for? Tell me a day, a budget or how many of you are going.`,
    changeVibe: "🎭 Change vibe",
    language: "🌐 Language",
    help: "Try something like:\n• something to do this Saturday under 500 baht\n• something creative and free\n• 4 of us tonight",
    examples: [
      ["This Sat under ฿500", "something to do this Saturday under 500 baht"],
      ["Creative & free", "something creative and free"],
      ["6 of us tonight", "6 of us tonight"],
    ],
    found: (n, v) => `Found ${n} match${n > 1 ? "es" : ""}${v ? ` for a ${v}` : ""}! Swipe through 👉`,
    noMatch: "😕 No matches",
    noMatchTail: "Scoop only suggests real listings. Try a different day, budget or group size.",
    reasonParty: (w, n) => `nothing in ${w} still has seats for a group of ${n}`,
    reasonPrice: (w, b) => `nothing in ${w} fits a ${b} budget`,
    reasonCategory: (w, c) => `there are no ${c} events in ${w}`,
    reasonDate: (w) => `nothing matching is on in ${w}`,
    free: "Free",
    spotsLeft: (n) => `${n} spots left`,
    book: "Book",
    map: "Map",
    seeAllOnMap: (n) => `See all ${n} on a map`,
    openMap: "Open map",
    booked: "Booking confirmed!",
    bookedAlt: (t) => `Booked: ${t}`,
    when: "When",
    where: "Where",
    price: "Price",
    code: "Code",
    ticketUnit: "ticket",
    demoNote: "Demo reservation — no payment taken",
    full: "Sorry, this one is full or no longer taking bookings 😢",
    reminderSet: (t, at) => `🔔 Reminder set! I'll message you on the day · ${at}\nAdd it to Google Calendar with the button on your ticket.\nSee you at ${t} 🥳`,
    addToCalendar: "📅 Add to Google Calendar",
    openingApp: (a) => `Opening ${a}…`,
    openApp: (a) => `Open the ${a} app`,
    copyAndOpen: (a) => `📋 Copy destination & open ${a}`,
    backToLine: "↩️ Back to LINE",
    guideMeet: "Meet",
    watchReview: "▶️ Reviews",
    guideMinutes: (n) => `~${n} min`,
    transitTitle: "🚆 Go by BTS / MRT",
    transitSummary: (m, f) => `⏱️ ~${m} min · 💰 ~฿${f}`,
    walkTo: (m, p) => `Walk ${m} min to ${p}`,
    rideLine: (l, t, s, to, m) => `${l} towards ${t}\n${s} stop${s === 1 ? "" : "s"} → get off at ${to} · ~${m} min`,
    changeAt: (st, m) => `Change at ${st} · ~${m} min`,
    walkOnly: (m) => `It's close — just walk, ~${m} min`,
    transitNote: "Times and fares are estimates · BTS and MRT are paid separately when you change systems",
    transitMaps: "🗺️ Route in Google Maps",
    noTransit: "No BTS / MRT station nearby — a ride is the better option.",
    lineName: { bts_sukhumvit: "BTS Sukhumvit Line", bts_silom: "BTS Silom Line", mrt_blue: "MRT Blue Line", mrt_purple: "MRT Purple Line", mrt_yellow: "MRT Yellow Line", mrt_pink: "MRT Pink Line", arl: "Airport Rail Link", gold: "Gold Line" },
    pasteHint: (a) => `In ${a}, tap “Where to?” and paste the place name (long-press → Paste).`,
    noApp: (a) => `If ${a} didn't open, you may not have it yet:`,
    destinationL: "Destination (copy it into the app)",
    copyDestination: "📋 Copy destination",
    copied: "✅ Copied",
    callVenue: "📞 Call the venue",
    phoneL: "Phone",
    contactL: "Contact",
    reminder: "⏰ Coming up:",
    bookingCode: "Booking code",
    sorry: "Sorry, something went wrong. Please try again.",
    mapHeader: (n) => `${n} events on the map`,
    directions: "Go",
    altFound: (n) => `Scoop found ${n} event${n === 1 ? "" : "s"}`,
    ride: "🚕 Get a ride",
    shareLocation: "Share your current location 📍 and I'll work out the distance, the fare and when to leave.",
    shareLocationBtn: "📍 Send my location",
    rideTitle: "🚕 Getting there",
    to: "To",
    distance: "Distance",
    travelTime: "Travel time",
    taxiFare: "Taxi meter",
    appFare: "Grab / LINE MAN",
    leaveBy: "Leave by",
    km: "km",
    min: "min",
    leaveNow: "Leave now",
    estimateNote: "Fares and times are estimates — the app shows the real price when you book.",
    openGrab: "Open Grab",
    openLineman: "Open LINE MAN",
    remindLeave: "⏰ Remind me to leave",
    leaveReminderSet: (t,s)=>`⏰ Done! I'll ping you ${s ? `in ${s} seconds (demo mode)` : `at ${t}`} with the ride buttons.`,
    timeToLeave: (title)=>`🚕 Time to head to ${title}! Grab a ride now.`,
    bookFirst: "Book an event first, then I can help you get there 😊",
  },
  zh: {
    welcome: "太好了！👋 我是 Scoop，你在曼谷找乐子的好朋友。\n\n我可以帮你：\n🔎 按日期、预算和人数找真实活动\n🎟️ 直接在聊天里预订\n🚇 告诉你怎么去：BTS、MRT 或打车\n🔔 活动开始前提醒你\n\n像跟朋友聊天一样告诉我就行，比如“这周六 2 个人，预算 500 泰铢”",
    nextTrip: "预订已完成 🎉\n接下来想去哪儿玩？还是帮你叫车去活动现场？👇",
    pickVibe: "先说说，你是哪种风格？选一个 👇",
    vibeChosen: (v) => `太棒了！曼谷的 ${v} 🌆\n想找什么活动？告诉我日期、预算或几个人去。`,
    changeVibe: "🎭 换风格",
    language: "🌐 语言",
    help: "可以这样问：\n• 这周六有什么活动，预算500以内\n• 有什么免费的创意活动\n• 今晚我们 4 个人",
    examples: [
      ["周六 ≤ ฿500", "这周六有什么活动，预算500以内"],
      ["免费创意活动", "有什么免费的创意活动"],
      ["今晚 6 个人", "今晚我们 6 个人"],
    ],
    found: (n, v) => `为${v ? ` ${v} ` : "你"}找到 ${n} 个活动！左右滑动查看 👉`,
    noMatch: "😕 没有找到",
    noMatchTail: "Scoop 只推荐真实存在的活动。换个日期、预算或人数试试吧。",
    reasonParty: (w, n) => `${w} 没有还剩 ${n} 个名额的活动`,
    reasonPrice: (w, b) => `${w} 没有符合预算（${b}）的活动`,
    reasonCategory: (w, c) => `${w} 没有 ${c} 类活动`,
    reasonDate: (w) => `${w} 没有符合条件的活动`,
    free: "免费",
    spotsLeft: (n) => `剩余 ${n} 个名额`,
    book: "预订",
    map: "地图",
    seeAllOnMap: (n) => `在地图上查看全部 ${n} 个`,
    openMap: "打开地图",
    booked: "预订成功！",
    bookedAlt: (t) => `已预订：${t}`,
    when: "时间",
    where: "地点",
    price: "价格",
    code: "编号",
    ticketUnit: "张",
    demoNote: "演示预订 — 未收取任何费用",
    full: "抱歉，这个活动已满或已停止预订 😢 换一个试试吧",
    reminderSet: (t, at) => `🔔 已设置提醒！Scoop 会在活动当天提醒你 · ${at}\n可以用票上的按钮添加到 Google 日历。\n${t} 见 🥳`,
    addToCalendar: "📅 添加到 Google 日历",
    openingApp: (a) => `正在打开 ${a}…`,
    openApp: (a) => `打开 ${a} App`,
    copyAndOpen: (a) => `📋 复制目的地并打开 ${a}`,
    backToLine: "↩️ 返回 LINE",
    guideMeet: "集合",
    watchReview: "▶️ 视频评测",
    guideMinutes: (n) => `约 ${n} 分钟`,
    transitTitle: "🚆 乘 BTS / MRT 前往",
    transitSummary: (m, f) => `⏱️ 约 ${m} 分钟 · 💰 约 ฿${f}`,
    walkTo: (m, p) => `步行 ${m} 分钟到 ${p}`,
    rideLine: (l, t, s, to, m) => `${l}，往 ${t} 方向\n坐 ${s} 站 → 在 ${to} 下车 · 约 ${m} 分钟`,
    changeAt: (st, m) => `在 ${st} 换乘 · 约 ${m} 分钟`,
    walkOnly: (m) => `很近！步行约 ${m} 分钟即可`,
    transitNote: "时间和票价均为估算 · BTS 与 MRT 换乘需分别付费",
    transitMaps: "🗺️ 在 Google 地图查看路线",
    noTransit: "附近没有 BTS / MRT 站，建议叫车前往。",
    lineName: { bts_sukhumvit: "BTS 素坤逸线", bts_silom: "BTS 是隆线", mrt_blue: "MRT 蓝线", mrt_purple: "MRT 紫线", mrt_yellow: "MRT 黄线", mrt_pink: "MRT 粉线", arl: "机场快线", gold: "金线" },
    pasteHint: (a) => `在 ${a} 里点“去哪儿”，然后粘贴地点名称（长按 → 粘贴）。`,
    noApp: (a) => `如果 ${a} 没有打开，可能还没安装：`,
    destinationL: "目的地（可复制到 App 中）",
    copyDestination: "📋 复制目的地",
    copied: "✅ 已复制",
    callVenue: "📞 致电场地",
    phoneL: "电话",
    contactL: "联系人",
    reminder: "⏰ 活动快开始了：",
    bookingCode: "预订编号",
    sorry: "抱歉，系统暂时出错，请再试一次。",
    mapHeader: (n) => `地图上的 ${n} 个活动`,
    directions: "导航",
    altFound: (n) => `Scoop 找到 ${n} 个活动`,
    ride: "🚕 叫车去活动",
    shareLocation: "发送你当前的位置 📍 Scoop 会帮你算距离、车费和出发时间。",
    shareLocationBtn: "📍 发送我的位置",
    rideTitle: "🚕 前往活动",
    to: "目的地",
    distance: "距离",
    travelTime: "车程",
    taxiFare: "出租车打表",
    appFare: "Grab / LINE MAN",
    leaveBy: "建议出发",
    km: "公里",
    min: "分钟",
    leaveNow: "现在出发",
    estimateNote: "车费和时间均为估算，实际价格以叫车 App 为准。",
    openGrab: "打开 Grab",
    openLineman: "打开 LINE MAN",
    remindLeave: "⏰ 出发时提醒我",
    leaveReminderSet: (t,s)=>`⏰ 已设置！Scoop 会在${s ? ` ${s} 秒后（演示模式）` : ` ${t} `}提醒你，并附上叫车按钮。`,
    timeToLeave: (title)=>`🚕 该出发去 ${title} 了！现在叫车吧。`,
    bookFirst: "先预订一个活动，再帮你叫车哦 😊",
  },
  hi: {
    welcome: "बढ़िया! 👋 मैं Scoop हूँ, बैंकॉक में मज़ेदार चीज़ें ढूँढने वाला आपका दोस्त।\n\nमैं ऐसे मदद कर सकता हूँ:\n🔎 दिन, बजट और लोगों की संख्या के हिसाब से असली इवेंट ढूँढूँ\n🎟️ यहीं चैट में बुकिंग करूँ\n🚇 BTS, MRT या टैक्सी से वहाँ पहुँचने का रास्ता बताऊँ\n🔔 इवेंट शुरू होने से पहले याद दिलाऊँ\n\nबस दोस्त की तरह बात करें, जैसे “इस शनिवार हम 2 लोग, 500 बाट से कम”",
    nextTrip: "आपकी बुकिंग हो गई 🎉\nअब कहाँ घूमने चलें — या इवेंट तक जाने के लिए राइड चाहिए? 👇",
    pickVibe: "पहले बताइए — आपका वाइब क्या है? एक चुनें 👇",
    vibeChosen: (v) => `बहुत बढ़िया! बैंकॉक में एक ${v} 🌆\nआप क्या ढूँढ रहे हैं? दिन, बजट या कितने लोग जा रहे हैं, बताइए।`,
    changeVibe: "🎭 वाइब बदलें",
    language: "🌐 भाषा",
    help: "ऐसे लिखकर देखें:\n• इस शनिवार 500 बाट से कम में क्या करें\n• कुछ क्रिएटिव और मुफ्त\n• आज रात हम 4 लोग",
    examples: [
      ["शनिवार ≤ ฿500", "इस शनिवार 500 बाट से कम में क्या करें"],
      ["फ्री क्रिएटिव", "कुछ क्रिएटिव और मुफ्त"],
      ["आज रात 6 लोग", "आज रात हम 6 लोग"],
    ],
    found: (n, v) => `${v ? `${v} के लिए ` : ""}${n} इवेंट ${n === 1 ? "मिला" : "मिले"}! स्वाइप करके देखें 👉`,
    noMatch: "😕 कुछ नहीं मिला",
    noMatchTail: "Scoop सिर्फ़ असली इवेंट सुझाता है। दूसरा दिन, बजट या लोगों की संख्या आज़माएँ।",
    reasonParty: (w, n) => `${w} में ${n} लोगों के लिए सीटें बची हों, ऐसा कोई इवेंट नहीं है`,
    reasonPrice: (w, b) => `${w} में ${b} बजट में कोई इवेंट नहीं है`,
    reasonCategory: (w, c) => `${w} में ${c} का कोई इवेंट नहीं है`,
    reasonDate: (w) => `${w} में ऐसा कोई इवेंट नहीं है`,
    free: "मुफ्त",
    spotsLeft: (n) => `${n} सीटें बाकी`,
    book: "बुक करें",
    map: "नक्शा",
    seeAllOnMap: (n) => `सभी ${n} नक्शे पर देखें`,
    openMap: "नक्शा खोलें",
    booked: "बुकिंग पक्की!",
    bookedAlt: (t) => `बुक हो गया: ${t}`,
    when: "कब",
    where: "कहाँ",
    price: "कीमत",
    code: "कोड",
    ticketUnit: "टिकट",
    demoNote: "डेमो बुकिंग — कोई भुगतान नहीं लिया गया",
    full: "माफ़ कीजिए, यह इवेंट भर गया है या बुकिंग बंद है 😢",
    reminderSet: (t, at) => `🔔 रिमाइंडर सेट! Scoop आपको इवेंट वाले दिन याद दिलाएगा · ${at}\nटिकट के बटन से Google Calendar में जोड़ें।\n${t} पर मिलते हैं 🥳`,
    addToCalendar: "📅 Google Calendar में जोड़ें",
    openingApp: (a) => `${a} खुल रहा है…`,
    openApp: (a) => `${a} ऐप खोलें`,
    copyAndOpen: (a) => `📋 गंतव्य कॉपी करें और ${a} खोलें`,
    backToLine: "↩️ LINE पर वापस जाएँ",
    guideMeet: "मिलने की जगह",
    watchReview: "▶️ रिव्यू",
    guideMinutes: (n) => `~${n} मिनट`,
    transitTitle: "🚆 BTS / MRT से जाएँ",
    transitSummary: (m, f) => `⏱️ ~${m} मिनट · 💰 ~฿${f}`,
    walkTo: (m, p) => `${m} मिनट पैदल चलकर ${p}`,
    rideLine: (l, t, s, to, m) => `${l}, ${t} की ओर\n${s} स्टेशन → ${to} पर उतरें · ~${m} मिनट`,
    changeAt: (st, m) => `${st} पर लाइन बदलें · ~${m} मिनट`,
    walkOnly: (m) => `बहुत पास है — पैदल ~${m} मिनट`,
    transitNote: "समय और किराया अनुमान हैं · BTS और MRT बदलने पर अलग-अलग किराया लगता है",
    transitMaps: "🗺️ Google Maps में रास्ता देखें",
    noTransit: "पास में कोई BTS / MRT स्टेशन नहीं है — राइड लेना बेहतर है।",
    lineName: { bts_sukhumvit: "BTS सुखुमवित लाइन", bts_silom: "BTS सिलोम लाइन", mrt_blue: "MRT ब्लू लाइन", mrt_purple: "MRT पर्पल लाइन", mrt_yellow: "MRT येलो लाइन", mrt_pink: "MRT पिंक लाइन", arl: "एयरपोर्ट रेल लिंक", gold: "गोल्ड लाइन" },
    pasteHint: (a) => `${a} में “कहाँ जाना है?” पर टैप करें और जगह का नाम पेस्ट करें (दबाकर रखें → पेस्ट)।`,
    noApp: (a) => `अगर ${a} नहीं खुला, तो शायद ऐप इंस्टॉल नहीं है:`,
    destinationL: "गंतव्य (ऐप में कॉपी करें)",
    copyDestination: "📋 गंतव्य कॉपी करें",
    copied: "✅ कॉपी हो गया",
    callVenue: "📞 वेन्यू को कॉल करें",
    phoneL: "फ़ोन",
    contactL: "संपर्क",
    reminder: "⏰ जल्द शुरू:",
    bookingCode: "बुकिंग कोड",
    sorry: "माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।",
    mapHeader: (n) => `नक्शे पर ${n} इवेंट`,
    directions: "रास्ता",
    altFound: (n) => `Scoop को ${n} इवेंट मिले`,
    ride: "🚕 राइड लें",
    shareLocation: "अपनी मौजूदा लोकेशन भेजें 📍 Scoop दूरी, किराया और निकलने का समय बताएगा।",
    shareLocationBtn: "📍 मेरी लोकेशन भेजें",
    rideTitle: "🚕 इवेंट तक पहुँचें",
    to: "कहाँ",
    distance: "दूरी",
    travelTime: "समय",
    taxiFare: "टैक्सी मीटर",
    appFare: "Grab / LINE MAN",
    leaveBy: "निकलें",
    km: "किमी",
    min: "मिनट",
    leaveNow: "अभी निकलें",
    estimateNote: "किराया और समय अनुमान हैं — असली कीमत बुक करते समय ऐप में दिखेगी।",
    openGrab: "Grab खोलें",
    openLineman: "LINE MAN खोलें",
    remindLeave: "⏰ निकलने पर याद दिलाएँ",
    leaveReminderSet: (t,s)=>`⏰ हो गया! Scoop आपको ${s ? `${s} सेकंड में (डेमो मोड)` : `${t} बजे`} राइड बटन के साथ याद दिलाएगा।`,
    timeToLeave: (title)=>`🚕 ${title} के लिए निकलने का समय हो गया! अभी राइड बुक करें।`,
    bookFirst: "पहले कोई इवेंट बुक करें, फिर मैं वहाँ पहुँचने में मदद करूँगा 😊",
  },
};

// ---------- menu, step-by-step search, bookings, calendar, profile ----------

type MenuStrings = {
  hello: string;
  languageChanged: string;
  rankedFound: (n: number, name?: string) => string;
  matchWord: string;
  matchHint: string;
  rVibe: (vibe: string) => string;
  rHistory: (category: string) => string;
  rBudget: string;
  rNear: (km: number) => string;
  rGroup: (n: number) => string;
  rSoon: string;
  rFree: string;
  menuTitle: string;
  find: string;
  findShort: string; // quick-reply labels are capped at 20 characters
  myBookings: string;
  getRide: string;
  calendar: string;
  profile: string;
  bookMore: string;
  menu: string;
  stepOf: (i: number, n: number) => string;
  askWhen: string;
  askBudget: string;
  askPeople: string;
  askType: string;
  whenLabel: Record<"tonight" | "today" | "tomorrow" | "this_saturday" | "this_sunday" | "this_weekend" | "this_week" | "any", string>;
  pickDate: string;
  nextDays: (n: number) => string;
  wizardHint: string;
  whenTitle: string;
  whenSub: string;
  typeTitle: string;
  typeSub: string;
  typeHint: string;
  surprise: string;
  myVibe: (vibe: string) => string;
  newSearch: string;
  notQuiteTitle: string;
  notQuiteSub: string;
  budgetChip: (label: string) => string;
  peopleChip: (label: string) => string;
  back: string;
  anyBudget: string;
  justMe: string;
  people: (n: number) => string;
  anyPeople: string;
  anything: string;
  noBookings: string;
  ticketsN: (n: number) => string;
  edit: string;
  cancel: string;
  ride: string;
  map: string;
  ended: string;
  howManyTickets: (title: string) => string;
  notEnoughSeats: (n: number) => string;
  ticketsUpdated: (n: number) => string;
  cancelQ: string;
  cancelBooking: string;
  cancelSome: string;
  editTickets: string;
  cancelShort: string;
  cancelSomeQ: (title: string, booked: number) => string;
  cancelK: (k: number, left: number) => string;
  cancelAllN: (n: number) => string;
  cancelledSome: (k: number, left: number, title: string) => string;
  yesCancel: string;
  keep: string;
  cancelled: (title: string) => string;
  calendarTitle: string;
  calendarHint: string;
  profileTitle: string;
  languageL: string;
  vibeL: string;
  usualBudgetL: string;
  usualPeopleL: string;
  upcomingL: string;
  notSet: string;
  changeLanguage: string;
  changeVibe: string;
  setBudget: string;
  setPeople: string;
  saved: string;
  chooseBooking: string;
  cat: Record<string, string>;
};

export const M: Record<Lang, MenuStrings> = {
  th: {
    hello: "สวัสดีอีกครั้ง! 👋",
    rankedFound: (n, name) => `เจอ ${n} งาน เรียงจากที่เข้ากับ${name ? `คุณ${name}` : "คุณ"}มากที่สุด 🎯 ปัดดูได้เลย 👉`,
    matchWord: "ตรงกับคุณ",
    matchHint: "💡 เลือกสายในโปรไฟล์ เพื่อดู % ความเข้ากับคุณของแต่ละงาน",
    rVibe: (v) => `ตรงกับ${v}`,
    rHistory: (c) => `คุณเคยจองงาน${c}`,
    rBudget: "อยู่ในงบปกติ",
    rNear: (km) => `ห่างคุณ ~${km} กม.`,
    rGroup: (n) => `มีที่พอ ${n} คน`,
    rSoon: "ใกล้ถึงแล้ว",
    rFree: "เข้าฟรี",
    languageChanged: "✅ เปลี่ยนเป็นภาษาไทยแล้ว",
    menuTitle: "อยากทำอะไรดี? 👇",
    find: "🔍 หาอะไรทำ",
    findShort: "🔍 หาอะไรทำ",
    myBookings: "📅 การจองของฉัน",
    getRide: "🚕 เรียกรถไปงาน",
    calendar: "🗓️ ปฏิทิน",
    profile: "👤 โปรไฟล์",
    bookMore: "➕ จองเพิ่ม",
    menu: "🏠 เมนู",
    stepOf: (i, n) => `ขั้นที่ ${i}/${n}`,
    askWhen: "📅 ไปวันไหน?",
    askBudget: "💰 งบต่อคนเท่าไหร่?",
    askPeople: "👥 ไปกี่คน?",
    askType: "🎭 อยากทำอะไร?",
    whenLabel: { tonight: "คืนนี้", today: "วันนี้", tomorrow: "พรุ่งนี้", this_saturday: "เสาร์นี้", this_sunday: "วันอาทิตย์นี้", this_weekend: "เสาร์-อาทิตย์นี้", this_week: "สัปดาห์นี้", any: "วันไหนก็ได้" },
    pickDate: "📆 เลือกวันที่",
    nextDays: (n) => `อีก ${n} วัน`,
    wizardHint: "ไม่แน่ใจว่าหมายถึงอะไร 🤔 แตะตัวเลือกด้านล่าง หรือพิมพ์คำตอบได้เลย",
    whenTitle: "📅 ว่างวันไหน?",
    whenSub: "แตะเลือก หรือพิมพ์วันที่ได้เลย",
    typeTitle: "🎭 อยากทำอะไร?",
    typeSub: "เลือกประเภทงานที่ชอบ",
    typeHint: "✍️ หรือพิมพ์เองก็ได้ เช่น “เสาร์นี้ 2 คน งบ 500 อาหาร”",
    surprise: "✨ อะไรก็ได้ เซอร์ไพรส์เลย",
    myVibe: (v) => `⭐ สายของฉัน: ${v}`,
    newSearch: "🔍 ค้นหาใหม่",
    notQuiteTitle: "🙅 ยังไม่ถูกใจ?",
    notQuiteSub: "ย้อนกลับไปเลือกประเภทใหม่ หรือเริ่มค้นหาใหม่ได้เลย",
    budgetChip: (l) => `💰 ${l}`,
    peopleChip: (l) => `👥 ${l}`,
    back: "← ย้อนกลับ",
    anyBudget: "ไม่จำกัดงบ",
    justMe: "ไปคนเดียว",
    people: (n) => `${n} คน`,
    anyPeople: "ไม่ระบุ",
    anything: "อะไรก็ได้",
    noBookings: "ยังไม่มีการจองเลย ลองหางานที่ชอบดูนะ 😊",
    ticketsN: (n) => `${n} ที่`,
    edit: "✏️ แก้ไข",
    cancel: "❌ ยกเลิก",
    ride: "🚕 เรียกรถ",
    map: "🗺️ แผนที่",
    ended: "จบแล้ว",
    howManyTickets: (t) => `ต้องการกี่ที่สำหรับ ${t}?`,
    notEnoughSeats: (n) => `ขอโทษนะ ที่ว่างเหลือแค่ ${n} ที่ 😢`,
    ticketsUpdated: (n) => `✅ อัปเดตเป็น ${n} ที่แล้ว`,
    cancelQ: "ยกเลิกการจองนี้ไหม?",
    cancelBooking: "❌ ยกเลิกการจอง",
    cancelSome: "➖ ยกเลิกบางที่",
    editTickets: "✏️ แก้จำนวนที่",
    cancelShort: "ยกเลิก",
    cancelSomeQ: (t, n) => `จะยกเลิกกี่ที่ สำหรับ ${t}? (จองไว้ ${n} ที่)`,
    cancelK: (k, left) => `ยกเลิก ${k} · เหลือ ${left}`,
    cancelAllN: (n) => `ยกเลิกทั้งหมด ${n} ที่`,
    cancelledSome: (k, left, t) => `✅ ยกเลิก ${k} ที่แล้ว เหลือ ${left} ที่ สำหรับ ${t}`,
    yesCancel: "ยืนยันยกเลิก",
    keep: "ไม่ยกเลิก",
    cancelled: (t) => `ยกเลิกการจอง ${t} แล้ว คืนที่นั่งเรียบร้อย`,
    calendarTitle: "🗓️ ปฏิทินของฉัน",
    calendarHint: "แตะที่งานเพื่อเพิ่มลง Google Calendar",
    profileTitle: "👤 โปรไฟล์",
    languageL: "ภาษา",
    vibeL: "สาย",
    usualBudgetL: "งบปกติ",
    usualPeopleL: "ไปกันปกติ",
    upcomingL: "การจองที่จะถึง",
    notSet: "ยังไม่ได้ตั้ง",
    changeLanguage: "🌐 เปลี่ยนภาษา",
    changeVibe: "🎭 เปลี่ยนสาย",
    setBudget: "💰 ตั้งงบปกติ",
    setPeople: "👥 ตั้งจำนวนคนปกติ",
    saved: "✅ บันทึกแล้ว",
    chooseBooking: "จะเรียกรถไปงานไหน?",
    cat: { art: "ศิลปะ", workshop: "เวิร์กช็อป", food: "อาหาร", music: "ดนตรี", market: "ตลาด", comedy: "ตลก", film: "หนัง", nightlife: "ปาร์ตี้", sports: "กีฬา" },
  },
  en: {
    hello: "Hi again! 👋",
    rankedFound: (n, name) => `Found ${n}, ranked by how well they match ${name ? name : "you"} 🎯 Swipe through 👉`,
    matchWord: "match",
    matchHint: "💡 Pick your vibe in Profile to see how well each event matches you",
    rVibe: (v) => `Fits your ${v} vibe`,
    rHistory: (c) => `You've booked ${c} before`,
    rBudget: "Within your usual budget",
    rNear: (km) => `~${km} km from you`,
    rGroup: (n) => `Room for ${n}`,
    rSoon: "Coming up soon",
    rFree: "Free entry",
    languageChanged: "✅ Switched to English",
    menuTitle: "What would you like to do? 👇",
    find: "🔍 Find something to do",
    findShort: "🔍 Find events",
    myBookings: "📅 My bookings",
    getRide: "🚕 Get a ride",
    calendar: "🗓️ Calendar",
    profile: "👤 Profile",
    bookMore: "➕ Book something else",
    menu: "🏠 Menu",
    stepOf: (i, n) => `Step ${i}/${n}`,
    askWhen: "📅 When?",
    askBudget: "💰 Budget per person?",
    askPeople: "👥 How many people?",
    askType: "🎭 What kind of thing?",
    whenLabel: { tonight: "Tonight", today: "Today", tomorrow: "Tomorrow", this_saturday: "This Sat", this_sunday: "This Sun", this_weekend: "This weekend", this_week: "This week", any: "Any day" },
    pickDate: "📆 Pick a date",
    nextDays: (n) => `Next ${n} days`,
    wizardHint: "Not sure what you meant 🤔 Tap an option below, or type your answer.",
    whenTitle: "📅 When are you free?",
    whenSub: "Tap one — or type any date",
    typeTitle: "🎭 What are you in the mood for?",
    typeSub: "Pick a type of event",
    typeHint: "✍️ Or just type it, e.g. “2 of us, Sat, under ฿500, food”",
    surprise: "✨ Surprise me",
    myVibe: (v) => `⭐ My vibe: ${v}`,
    newSearch: "🔍 New search",
    notQuiteTitle: "🙅 Not quite right?",
    notQuiteSub: "Go back and pick another type, or start a new search.",
    budgetChip: (l) => `💰 ${l}`,
    peopleChip: (l) => `👥 ${l}`,
    back: "← Back",
    anyBudget: "Any budget",
    justMe: "Just me",
    people: (n) => `${n} people`,
    anyPeople: "Not sure",
    anything: "Anything",
    noBookings: "No bookings yet — let's find you something 😊",
    ticketsN: (n) => `${n} ticket${n === 1 ? "" : "s"}`,
    edit: "✏️ Edit",
    cancel: "❌ Cancel",
    ride: "🚕 Ride",
    map: "🗺️ Map",
    ended: "Ended",
    howManyTickets: (t) => `How many tickets for ${t}?`,
    notEnoughSeats: (n) => `Sorry, only ${n} spot${n === 1 ? "" : "s"} left 😢`,
    ticketsUpdated: (n) => `✅ Updated to ${n} ticket${n === 1 ? "" : "s"}`,
    cancelQ: "Cancel this booking?",
    cancelBooking: "❌ Cancel booking",
    cancelSome: "➖ Cancel some tickets",
    editTickets: "✏️ Change tickets",
    cancelShort: "Cancel",
    cancelSomeQ: (t, n) => `How many tickets to cancel for ${t}? (you have ${n})`,
    cancelK: (k, left) => `Cancel ${k} · keep ${left}`,
    cancelAllN: (n) => `Cancel all ${n}`,
    cancelledSome: (k, left, t) => `✅ Cancelled ${k} ticket${k === 1 ? "" : "s"} — ${left} left for ${t}`,
    yesCancel: "Yes, cancel",
    keep: "Keep it",
    cancelled: (t) => `Your booking for ${t} is cancelled and the spots are released.`,
    calendarTitle: "🗓️ My calendar",
    calendarHint: "Tap an event to add it to Google Calendar",
    profileTitle: "👤 Profile",
    languageL: "Language",
    vibeL: "Vibe",
    usualBudgetL: "Usual budget",
    usualPeopleL: "Usual group",
    upcomingL: "Upcoming bookings",
    notSet: "Not set",
    changeLanguage: "🌐 Change language",
    changeVibe: "🎭 Change vibe",
    setBudget: "💰 Usual budget",
    setPeople: "👥 Usual group size",
    saved: "✅ Saved",
    chooseBooking: "Which booking do you need a ride to?",
    cat: { art: "Art", workshop: "Workshop", food: "Food", music: "Music", market: "Market", comedy: "Comedy", film: "Film", nightlife: "Nightlife", sports: "Sports" },
  },
  zh: {
    hello: "又见面啦！👋",
    rankedFound: (n, name) => `为${name ?? "你"}找到 ${n} 个活动，按匹配度排序 🎯 左右滑动查看 👉`,
    matchWord: "匹配",
    matchHint: "💡 在个人资料里选择风格，就能看到每个活动与你的匹配度",
    rVibe: (v) => `符合${v}`,
    rHistory: (c) => `你订过${c}活动`,
    rBudget: "在常用预算内",
    rNear: (km) => `离你约 ${km} 公里`,
    rGroup: (n) => `够 ${n} 人`,
    rSoon: "即将开始",
    rFree: "免费入场",
    languageChanged: "✅ 已切换为中文",
    menuTitle: "想做什么？👇",
    find: "🔍 找活动",
    findShort: "🔍 找活动",
    myBookings: "📅 我的预订",
    getRide: "🚕 叫车去活动",
    calendar: "🗓️ 日历",
    profile: "👤 个人资料",
    bookMore: "➕ 再订一个",
    menu: "🏠 菜单",
    stepOf: (i, n) => `第 ${i}/${n} 步`,
    askWhen: "📅 哪天去？",
    askBudget: "💰 每人预算多少？",
    askPeople: "👥 几个人？",
    askType: "🎭 想玩什么？",
    whenLabel: { tonight: "今晚", today: "今天", tomorrow: "明天", this_saturday: "这周六", this_sunday: "这周日", this_weekend: "这个周末", this_week: "这周", any: "哪天都行" },
    pickDate: "📆 选择日期",
    nextDays: (n) => `未来 ${n} 天`,
    wizardHint: "没太明白 🤔 请点下面的选项，或直接输入答案。",
    whenTitle: "📅 哪天有空？",
    whenSub: "点选一个，或直接输入日期",
    typeTitle: "🎭 想玩点什么？",
    typeSub: "选择活动类型",
    typeHint: "✍️ 也可以直接输入，例如“周六 2 个人 预算500 美食”",
    surprise: "✨ 随便，给我惊喜",
    myVibe: (v) => `⭐ 我的风格：${v}`,
    newSearch: "🔍 重新搜索",
    notQuiteTitle: "🙅 不太满意？",
    notQuiteSub: "返回换个类型，或者重新搜索。",
    budgetChip: (l) => `💰 ${l}`,
    peopleChip: (l) => `👥 ${l}`,
    back: "← 返回",
    anyBudget: "不限预算",
    justMe: "就我一个",
    people: (n) => `${n} 人`,
    anyPeople: "不确定",
    anything: "都可以",
    noBookings: "还没有预订哦，去找找喜欢的活动吧 😊",
    ticketsN: (n) => `${n} 张`,
    edit: "✏️ 修改",
    cancel: "❌ 取消",
    ride: "🚕 叫车",
    map: "🗺️ 地图",
    ended: "已结束",
    howManyTickets: (t) => `${t} 需要几张票？`,
    notEnoughSeats: (n) => `抱歉，只剩 ${n} 个名额了 😢`,
    ticketsUpdated: (n) => `✅ 已更新为 ${n} 张`,
    cancelQ: "要取消这个预订吗？",
    cancelBooking: "❌ 取消预订",
    cancelSome: "➖ 取消部分票",
    editTickets: "✏️ 修改票数",
    cancelShort: "取消",
    cancelSomeQ: (t, n) => `${t} 要取消几张？（已订 ${n} 张）`,
    cancelK: (k, left) => `取消 ${k} · 留 ${left}`,
    cancelAllN: (n) => `全部取消 ${n} 张`,
    cancelledSome: (k, left, t) => `✅ 已取消 ${k} 张，${t} 还剩 ${left} 张`,
    yesCancel: "确认取消",
    keep: "保留",
    cancelled: (t) => `已取消 ${t} 的预订，名额已释放。`,
    calendarTitle: "🗓️ 我的日历",
    calendarHint: "点击活动可添加到 Google 日历",
    profileTitle: "👤 个人资料",
    languageL: "语言",
    vibeL: "风格",
    usualBudgetL: "常用预算",
    usualPeopleL: "常去人数",
    upcomingL: "即将参加",
    notSet: "未设置",
    changeLanguage: "🌐 更换语言",
    changeVibe: "🎭 更换风格",
    setBudget: "💰 常用预算",
    setPeople: "👥 常去人数",
    saved: "✅ 已保存",
    chooseBooking: "要叫车去哪个活动？",
    cat: { art: "艺术", workshop: "工作坊", food: "美食", music: "音乐", market: "市集", comedy: "喜剧", film: "电影", nightlife: "夜生活", sports: "运动" },
  },
  hi: {
    hello: "फिर से नमस्ते! 👋",
    rankedFound: (n, name) => `${name ?? "आप"} के लिए ${n} इवेंट, सबसे अच्छे मैच पहले 🎯 स्वाइप करें 👉`,
    matchWord: "मैच",
    matchHint: "💡 प्रोफ़ाइल में अपना वाइब चुनें और देखें हर इवेंट आपसे कितना मेल खाता है",
    rVibe: (v) => `आपके ${v} वाइब से मेल`,
    rHistory: (c) => `आपने पहले ${c} बुक किया`,
    rBudget: "सामान्य बजट में",
    rNear: (km) => `आपसे ~${km} किमी`,
    rGroup: (n) => `${n} लोगों की जगह`,
    rSoon: "जल्द शुरू",
    rFree: "मुफ्त प्रवेश",
    languageChanged: "✅ भाषा बदलकर हिन्दी कर दी गई",
    menuTitle: "आप क्या करना चाहेंगे? 👇",
    find: "🔍 कुछ करने को ढूँढें",
    findShort: "🔍 इवेंट खोजें",
    myBookings: "📅 मेरी बुकिंग",
    getRide: "🚕 राइड लें",
    calendar: "🗓️ कैलेंडर",
    profile: "👤 प्रोफ़ाइल",
    bookMore: "➕ और बुक करें",
    menu: "🏠 मेनू",
    stepOf: (i, n) => `चरण ${i}/${n}`,
    askWhen: "📅 कब जाना है?",
    askBudget: "💰 प्रति व्यक्ति बजट?",
    askPeople: "👥 कितने लोग?",
    askType: "🎭 क्या करना पसंद है?",
    whenLabel: { tonight: "आज रात", today: "आज", tomorrow: "कल", this_saturday: "इस शनिवार", this_sunday: "इस रविवार", this_weekend: "इस वीकेंड", this_week: "इस हफ्ते", any: "कभी भी" },
    pickDate: "📆 तारीख चुनें",
    nextDays: (n) => `अगले ${n} दिन`,
    wizardHint: "समझ नहीं आया 🤔 नीचे कोई विकल्प चुनें या अपना जवाब लिखें।",
    whenTitle: "📅 आप कब फ्री हैं?",
    whenSub: "एक चुनें — या कोई भी तारीख लिखें",
    typeTitle: "🎭 आज क्या करने का मन है?",
    typeSub: "इवेंट का प्रकार चुनें",
    typeHint: "✍️ या सीधे लिखें, जैसे “शनिवार 2 लोग 500 से कम खाना”",
    surprise: "✨ कुछ भी, सरप्राइज़ करो",
    myVibe: (v) => `⭐ मेरा वाइब: ${v}`,
    newSearch: "🔍 नई खोज",
    notQuiteTitle: "🙅 पसंद नहीं आया?",
    notQuiteSub: "वापस जाकर दूसरा प्रकार चुनें, या नई खोज शुरू करें।",
    budgetChip: (l) => `💰 ${l}`,
    peopleChip: (l) => `👥 ${l}`,
    back: "← वापस",
    anyBudget: "कोई भी बजट",
    justMe: "सिर्फ़ मैं",
    people: (n) => `${n} लोग`,
    anyPeople: "पता नहीं",
    anything: "कुछ भी",
    noBookings: "अभी कोई बुकिंग नहीं है। चलिए कुछ ढूँढते हैं 😊",
    ticketsN: (n) => `${n} टिकट`,
    edit: "✏️ बदलें",
    cancel: "❌ रद्द करें",
    ride: "🚕 राइड",
    map: "🗺️ नक्शा",
    ended: "खत्म",
    howManyTickets: (t) => `${t} के लिए कितने टिकट?`,
    notEnoughSeats: (n) => `माफ़ कीजिए, सिर्फ़ ${n} सीटें बची हैं 😢`,
    ticketsUpdated: (n) => `✅ अपडेट हो गया: ${n} टिकट`,
    cancelQ: "यह बुकिंग रद्द करें?",
    cancelBooking: "❌ बुकिंग रद्द करें",
    cancelSome: "➖ कुछ टिकट रद्द करें",
    editTickets: "✏️ टिकट संख्या बदलें",
    cancelShort: "रद्द",
    cancelSomeQ: (t, n) => `${t} के कितने टिकट रद्द करें? (आपके पास ${n})`,
    cancelK: (k, left) => `${k} रद्द · ${left} रखें`,
    cancelAllN: (n) => `सभी ${n} रद्द करें`,
    cancelledSome: (k, left, t) => `✅ ${k} टिकट रद्द — ${t} के लिए ${left} बचे`,
    yesCancel: "हाँ, रद्द करें",
    keep: "रहने दें",
    cancelled: (t) => `${t} की बुकिंग रद्द हो गई और सीटें वापस कर दी गईं।`,
    calendarTitle: "🗓️ मेरा कैलेंडर",
    calendarHint: "Google Calendar में जोड़ने के लिए इवेंट पर टैप करें",
    profileTitle: "👤 प्रोफ़ाइल",
    languageL: "भाषा",
    vibeL: "वाइब",
    usualBudgetL: "सामान्य बजट",
    usualPeopleL: "आम तौर पर लोग",
    upcomingL: "आने वाली बुकिंग",
    notSet: "सेट नहीं",
    changeLanguage: "🌐 भाषा बदलें",
    changeVibe: "🎭 वाइब बदलें",
    setBudget: "💰 सामान्य बजट",
    setPeople: "👥 लोगों की संख्या",
    saved: "✅ सेव हो गया",
    chooseBooking: "किस इवेंट के लिए राइड चाहिए?",
    cat: { art: "कला", workshop: "वर्कशॉप", food: "खाना", music: "संगीत", market: "बाज़ार", comedy: "कॉमेडी", film: "फिल्म", nightlife: "नाइटलाइफ़", sports: "खेल" },
  },
};
