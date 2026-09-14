import { test } from "node:test";
import assert from "node:assert/strict";
import { runAgent, systemPrompt } from "../src/agent.ts";
import type { ToolHandlers } from "../src/agent.ts";

// Runs the agent loop against a fake Ollama: each chat call returns the next scripted message. Calls that check a
// draft for invented facts (they send a JSON `format`) answer from `invented` instead, and aren't recorded.
function fakeOllama(replies: unknown[], invented: boolean[] = []) {
  const bodies: { messages: { role: string; content: string }[]; tools?: unknown[] }[] = [];
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    if (body.format) return new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify({ invented: invented.shift() ?? false }) } }));
    bodies.push(body);
    return new Response(JSON.stringify({ message: replies.shift() }));
  }) as typeof fetch;
  return bodies;
}

const noTools = {} as ToolHandlers;
const facts = { bookings: [], lastShown: [] };

test("calls a tool, feeds the result back, and returns the reply with the tool's cards", async () => {
  const bodies = fakeOllama([
    { role: "assistant", content: "", tool_calls: [{ function: { name: "search_events", arguments: { categories: ["music"] } } }] },
    { role: "assistant", content: "The **jazz night** looks fun!" },
  ]);
  const seen: unknown[] = [];
  const tools = { search_events: (args: unknown) => (seen.push(args), { result: { events: [{ id: "e1" }] }, messages: ["carousel"] }) } as unknown as ToolHandlers;

  const out = await runAgent("any jazz?", { facts, history: [], tools });

  assert.deepEqual(seen, [{ categories: ["music"] }]);
  assert.equal(out.reply, "The jazz night looks fun!"); // markdown stripped for LINE
  assert.deepEqual(out.cards, ["carousel"]);
  const toolMsg = bodies[1].messages.at(-1)!;
  assert.equal(toolMsg.role, "tool");
  assert.deepEqual(JSON.parse(toolMsg.content), { events: [{ id: "e1" }] });
});

test("a retried search shows its cards once", async () => {
  fakeOllama([
    { role: "assistant", content: "", tool_calls: [{ function: { name: "search_events", arguments: { price_max_thb: 100 } } }] },
    { role: "assistant", content: "", tool_calls: [{ function: { name: "search_events", arguments: {} } }] },
    { role: "assistant", content: "Found some." },
  ]);
  let n = 0;
  const tools = { search_events: () => ({ result: {}, messages: [`cards ${++n}`] }) } as unknown as ToolHandlers;
  const out = await runAgent("cheap stuff", { facts, history: [], tools });
  assert.deepEqual(out.cards, ["cards 2"]);
});

test("unknown tools and thrown errors go back to the model instead of crashing", async () => {
  const bodies = fakeOllama([
    { role: "assistant", content: "", tool_calls: [{ function: { name: "nope", arguments: "{}" } }, { function: { name: "book_event", arguments: "{\"event_id\":\"e1\"}" } }] },
    { role: "assistant", content: "Sorry, something went wrong." },
  ]);
  const tools = { book_event: () => { throw new Error("boom"); } } as unknown as ToolHandlers;
  const out = await runAgent("book it", { facts, history: [], tools });
  assert.equal(out.reply, "Sorry, something went wrong.");
  const results = bodies[1].messages.filter((m) => m.role === "tool").map((m) => JSON.parse(m.content));
  assert.match(results[0].error, /No tool called nope/);
  assert.match(results[1].error, /boom/);
});

test("stops offering tools after the last round, so it has to answer", async () => {
  const call = { role: "assistant", content: "", tool_calls: [{ function: { name: "search_events", arguments: {} } }] };
  const bodies = fakeOllama([call, call, call, call, { role: "assistant", content: "Here you go." }]);
  const tools = { search_events: () => ({ result: {} }) } as unknown as ToolHandlers;
  const out = await runAgent("loop", { facts, history: [], tools });
  assert.equal(out.reply, "Here you go.");
  assert.ok(bodies.at(-1)!.tools === undefined);
  assert.ok(bodies[0].tools !== undefined);
});

test("history and facts reach the model", async () => {
  const bodies = fakeOllama([{ role: "assistant", content: "Hi again!" }]);
  const history = [{ role: "user" as const, content: "hello" }, { role: "assistant" as const, content: "hey!" }];
  await runAgent("me again", { facts: { ...facts, name: "Ploy", bookings: ["SC-ABC123: 2 ticket(s) · e5 · Jazz"] }, history, tools: noTools });
  const [system, ...rest] = bodies[0].messages;
  assert.match(system.content, /Name: Ploy/);
  assert.match(system.content, /SC-ABC123/);
  assert.deepEqual(rest.map((m) => m.content), ["hello", "hey!", "me again"]);
});

test("a draft that invents events is dropped and the model is told to use a tool", async () => {
  const bodies = fakeOllama(
    [
      { role: "assistant", content: "Try the rooftop jazz bar on Silom, only ฿200!" },
      { role: "assistant", content: "", tool_calls: [{ function: { name: "search_events", arguments: { categories: ["music"] } } }] },
      { role: "assistant", content: "Found a jazz night for you." },
    ],
    [true],
  );
  const tools = { search_events: () => ({ result: { events: [] }, messages: ["carousel"] }) } as unknown as ToolHandlers;
  const out = await runAgent("jazz?", { facts, history: [], tools });
  assert.equal(out.reply, "Found a jazz night for you.");
  assert.equal(out.calls.length, 1);
  assert.ok(bodies[1].messages.some((m) => m.role === "system" && /not sent/.test(m.content)));
  assert.ok(!bodies[1].messages.some((m) => /rooftop/.test(m.content))); // the invented draft never enters the chat
});

test("the calendar names this weekend", () => {
  process.env.DEMO_NOW = "2026-09-14T10:00:00+07:00"; // a Monday
  const prompt = systemPrompt(facts);
  delete process.env.DEMO_NOW;
  assert.match(prompt, /2026-09-19 Saturday 19 Sept \(this week, this Saturday, this weekend\)/);
  assert.match(prompt, /2026-09-26 Saturday 26 Sept \(next Saturday, next weekend\)/);
});
