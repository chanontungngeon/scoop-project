import { CATEGORIES, DAY_MS, TZ, now } from "./data.ts";

// The chat side of Scoop. The model holds the conversation and calls tools; the tools are Scoop's own code
// (search, booking, directions), so events, prices, seats and booking codes always come from the data, never the model.

const { OLLAMA_URL = "http://localhost:11434", OLLAMA_MODEL = "qwen3:14b", OLLAMA_THINK } = process.env;

export type ChatTurn = { role: "user" | "assistant"; content: string };

type ToolCall = { function: { name: string; arguments: Record<string, unknown> | string } };
type OllamaMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: ToolCall[]; tool_name?: string };

// What a tool hands back: `result` goes to the model, `messages` (LINE cards) go to the user under the model's reply.
export type ToolResult = { result: unknown; messages?: unknown[] };
export type ToolHandlers = Record<ToolName, (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>>;

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOLS = [
  fn(
    "search_events",
    "Find events the user can book. Results are shown to the user as cards under your reply. Leave out anything the user didn't mention.",
    {
      date_from: { type: "string", description: "First day, YYYY-MM-DD. Use the calendar in the instructions." },
      date_to: { type: "string", description: "Last day, YYYY-MM-DD. Same as date_from for a single day." },
      after_time: { type: "string", description: "HH:MM. Only when the user says tonight, this evening or a time, e.g. 18:00 for tonight." },
      categories: { type: "array", items: { type: "string", enum: CATEGORIES }, description: "Only kinds of event the user asked for; don't guess. 'creative' means art and workshop." },
      price_max_thb: { type: "integer", description: "Most they want to pay per ticket, in baht. 0 means free only." },
      party_size: { type: "integer", description: "Total people going, including the user. 'me and 3 friends' is 4." },
    },
  ),
  fn("event_details", "Full details of one event: description, times, price range, venue, phone, how to get there, seats left.", {
    event_id: { type: "string" },
  }, ["event_id"]),
  fn("book_event", "Book tickets. Only call this once the user has clearly said which event and how many tickets.", {
    event_id: { type: "string" },
    tickets: { type: "integer" },
  }, ["event_id", "tickets"]),
  fn("change_booking", "Change how many tickets a booking has. tickets = 0 cancels the whole booking. Confirm with the user before cancelling.", {
    code: { type: "string", description: "Booking code, e.g. SC-1A2B3C" },
    tickets: { type: "integer", description: "New total number of tickets, or 0 to cancel" },
  }, ["code", "tickets"]),
  fn("get_directions", "How to get to a booked or shown event: taxi / Grab fare and BTS/MRT route. Asks the user for their location if needed.", {
    event_id: { type: "string" },
  }, ["event_id"]),
  fn("show_screen", "Show one of Scoop's screens as a card.", {
    screen: {
      type: "string",
      enum: ["menu", "bookings", "calendar", "profile", "language", "vibe"],
      description: "menu = home menu, bookings = their bookings with edit/cancel buttons, calendar = bookings by date, profile = their saved settings, language = language picker, vibe = vibe picker",
    },
  }, ["screen"]),
] as const;

export type ToolName = (typeof TOOLS)[number]["function"]["name"];

// Facts about this user and moment, rebuilt for every message.
export type Facts = {
  name?: string;
  vibe?: string;
  usualBudget?: number | null;
  usualPeople?: number | null;
  bookings: string[]; // one line each
  lastShown: string[]; // events on screen from the latest search, one line each
  lastSearch?: string; // the filters behind those events
  awaiting?: string; // a question a tapped button just asked, e.g. "a new budget for the latest search"
  firstChat?: boolean; // no earlier typed messages from this user
  language?: string; // what the latest message is written in, e.g. "English"
};

// Small models get "this Saturday" wrong from a date alone, so every day says what people would call it.
function calendar(days = 14): string {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" });
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" });
  const today = weekday.format(now());
  const daysToSunday = (7 - ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(today)) % 7;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now().getTime() + i * DAY_MS);
    const name = weekday.format(d);
    const labels = [i === 0 && "today", i === 1 && "tomorrow", i <= 6 && "this week", i <= daysToSunday && (name === "Saturday" || name === "Sunday") && `this ${name}, this weekend`, i > daysToSunday && i <= daysToSunday + 7 && (name === "Saturday" || name === "Sunday") && `next ${name}, next weekend`].filter(Boolean);
    return `${iso.format(d)} ${fmt.format(d)}${labels.length ? ` (${labels.join(", ")})` : ""}`;
  }).join("\n");
}

export function systemPrompt(f: Facts): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now());
  const list = (lines: string[], none: string) => (lines.length ? lines.map((l) => `- ${l}`).join("\n") : none);
  return `You are Scoop, a friendly Bangkok local who helps people find things to do, book them and get there, in a LINE chat.

How you talk:
- Reply in the language of the user's latest message${f.language ? `, which is ${f.language}` : " (Thai, English, Chinese or Hindi)"}.
- In Thai, call yourself "เรา" and end politely with ค่ะ / คะ (never ผม, ฉัน or ครับ), so Scoop always sounds like the same person.
- Sound like a friend texting: warm, casual, short. Usually 1–3 sentences. An emoji now and then is fine. No markdown, no bullet lists.
- Ask one question at a time when you need something (when, what kind, budget, how many people). If they give enough to search, search straight away.
- Chat naturally about anything, but gently bring it back to things to do in Bangkok.
- Introducing yourself: when the user only says hi, or asks who you are or what you can do, say you're Scoop, a Bangkok friend who (1) finds fun things to do, (2) books them right here in the chat, (3) shows how to get there by BTS, MRT or taxi and (4) reminds them before it starts. Mention all four in 2–3 short sentences, in their language, then ask what they're in the mood for.
- If it's your first chat and their message already asks for something, don't give the whole introduction: say in a few words that you're Scoop, then do what they asked.

What's true:
- You don't know any events, venues, prices, routes or fares yourself. The only way to know them is to call a tool.
- So when the user wants ideas or asks what's on, call search_events first, then answer from its results. When they ask how to get somewhere, call get_directions. Never describe an event, place or route that no tool gave you.
- Never make up booking codes, seats or times.
- Search results appear as cards right under your message, so never write a list of events. They're ranked by match_percent, how well each fits this user; match_reasons says why. Mention the one or two that fit best by name and say why, then ask what they think.
- To book or get directions, pass the event's id exactly as a search result or the events on screen give it. The user must have seen an event before you book it: if nothing is on screen, search first. If a tool says the id is wrong, use one from the list it gives back.
- If a search finds nothing, the tool says which filter blocked it and gives the closest events without that filter, shown as cards. Say so simply and suggest one of those.
- Never show the user event ids, tool names or error messages. Say what happened in plain words.
- Book only after the user has made clear which event and how many tickets. Before cancelling, check with them first.
- "The second one", "that jazz thing" and so on refer to the events on screen below.

Right now in Bangkok: ${time}. Next two weeks:
${calendar()}

The user:
- Name: ${f.name ?? "unknown"}${f.firstChat ? "\n- This is your first chat with them" : ""}
- Vibe: ${f.vibe ?? "not set"} — if they don't say what kind of event, it's fine to lean towards this
- Usual budget: ${f.usualBudget != null ? `฿${f.usualBudget}` : "not set"}; usually goes with: ${f.usualPeople != null ? `${f.usualPeople} people` : "not set"}

Their bookings:
${list(f.bookings, "none")}

Events on screen from the latest search${f.lastSearch ? ` (${f.lastSearch})` : ""}:
${list(f.lastShown, "none")}${f.awaiting ? `\n\nScoop just asked the user for ${f.awaiting}. If their message answers it, search again with the same filters and the new value.` : ""}`;
}

// Every call must use the same context size: Ollama reloads the whole model when it changes. Ollama's default context
// is too small for the prompt, tools and history. keep_alive stops it unloading after 5 idle minutes (a cold load
// takes up to a minute).
const NUM_CTX = 8192;
const KEEP_ALIVE = "60m";

async function chat(messages: OllamaMessage[], withTools: boolean, think = OLLAMA_THINK === "1"): Promise<OllamaMessage> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      keep_alive: KEEP_ALIVE,
      think, // qwen3 can reason before answering: better tool use, several seconds slower
      messages,
      ...(withTools ? { tools: TOOLS } : {}),
      options: { temperature: 0.5, num_ctx: NUM_CTX },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { message: OllamaMessage }).message;
}

// Small models sometimes skip the tools and describe events, venues or routes from imagination. When a reply used
// no tools, a second short call checks it against what's actually on screen; if it invented something, the draft is
// dropped and the model is told to use a tool.
const CHECK_SCHEMA = { type: "object", required: ["invented"], properties: { invented: { type: "boolean" } } };

async function inventsFacts(reply: string, facts: Facts): Promise<boolean> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      keep_alive: KEEP_ALIVE,
      think: false,
      format: CHECK_SCHEMA,
      options: { temperature: 0, num_ctx: NUM_CTX },
      messages: [
        {
          role: "system",
          content: `You check a chatbot's reply. The bot knows only these events and bookings:\n${[...facts.lastShown, ...facts.bookings].join("\n") || "(none)"}\n\n` +
            `The bot has not booked, cancelled or changed anything in this reply.\n\n` +
            `invented = true if the reply names or describes any specific event, activity, venue, price, time, travel route or booking that is not in that list, ` +
            `or says it has booked, cancelled or changed something. ` +
            `Greetings, questions (including "shall I cancel it?"), general suggestions of a kind of thing to do ("music or food?"), and describing what Scoop can do in general (find events, book in the chat, directions by BTS, MRT or taxi, reminders) are not invented.`,
        },
        { role: "user", content: reply },
      ],
    }),
  });
  if (!res.ok) return false; // the check is a safety net; never fail the reply because of it
  try {
    return (JSON.parse(((await res.json()) as { message: { content: string } }).message.content) as { invented: boolean }).invented === true;
  } catch {
    return false;
  }
}

const NUDGE = "Your last draft described events, places, prices or routes that no tool gave you, or claimed an action no tool did, so it was not sent. " +
  "Call the right tool now (search_events for ideas, event_details for questions about an event, get_directions for getting there, book_event or change_booking to act), " +
  "or ask the user a question instead.";

const MAX_ROUNDS = 4;
export const HISTORY_TURNS = 12;

// One user message in, one reply out. Cards from the latest call of each tool are kept, so a search the model
// retried with looser filters shows once.
export async function runAgent(text: string, opts: { facts: Facts; history: ChatTurn[]; tools: ToolHandlers }) {
  const messages: OllamaMessage[] = [{ role: "system", content: systemPrompt(opts.facts) }, ...opts.history.slice(-HISTORY_TURNS), { role: "user", content: text }];
  const cards = new Map<string, unknown[]>();
  const calls: { name: string; args: Record<string, unknown>; result: unknown }[] = [];

  let dropped = 0;
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    // Last round: no tools, so it has to answer. After a dropped draft, let it think first: slower, but more careful.
    const msg = await chat(messages, round < MAX_ROUNDS, dropped > 0);
    if (!msg.tool_calls?.length) {
      // LINE shows markdown as literal characters.
      const reply = (msg.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\*\*|__|^#+\s*/gm, "").trim();
      if (calls.length === 0 && reply && (await inventsFacts(reply, opts.facts))) {
        console.log(JSON.stringify({ droppedDraft: reply }));
        // Twice in a row: send nothing rather than something untrue; the server says sorry instead.
        if (++dropped === 2 || round === MAX_ROUNDS) return { reply: "", cards: [...cards.values()].flat(), calls };
        messages.push({ role: "system", content: NUDGE });
        continue;
      }
      return { reply, cards: [...cards.values()].flat(), calls };
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      const name = call.function.name;
      const args = typeof call.function.arguments === "string" ? safeJson(call.function.arguments) : call.function.arguments ?? {};
      const handler = (opts.tools as Record<string, ToolHandlers[ToolName] | undefined>)[name];
      let out: ToolResult;
      try {
        out = handler ? await handler(args) : { result: { error: `No tool called ${name}` } };
      } catch (err) {
        out = { result: { error: String(err) } };
      }
      if (out.messages) {
        cards.delete(name); // re-insert so cards stay in the order the tools were last used
        cards.set(name, out.messages);
      }
      calls.push({ name, args, result: out.result });
      messages.push({ role: "tool", tool_name: name, content: JSON.stringify(out.result) });
    }
  }
  return { reply: "", cards: [...cards.values()].flat(), calls };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}
