import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterEvents, blockingConstraint } from "../src/filter.ts";
import type { Event, Filter } from "../src/filter.ts";

type EvalCase = { id: string; query: string; filter: Filter; expected_ids: string[]; note?: string };

const data = JSON.parse(readFileSync(new URL("../scoop-mock-data-bkk.json", import.meta.url), "utf8")) as {
  events: Event[];
  eval_set: EvalCase[];
};

test("eval set has at least three empty cases", () => {
  assert.ok(data.eval_set.filter((c) => c.expected_ids.length === 0).length >= 3);
});

for (const c of data.eval_set) {
  test(`${c.expected_ids.length === 0 ? "[EMPTY] " : ""}${c.id}: ${c.query}`, () => {
    const got = filterEvents(data.events, c.filter).map((e) => e.id);
    assert.deepEqual(got, c.expected_ids, c.note ?? c.id);
  });
}

test("blocking constraint is named for empty cases", () => {
  const byId = Object.fromEntries(data.eval_set.map((c) => [c.id, c]));
  assert.equal(blockingConstraint(data.events, byId["empty-tonight-party-of-6"].filter), "party_size");
  assert.equal(blockingConstraint(data.events, byId["empty-cheap-food-sat-26"].filter), "category");
  assert.equal(blockingConstraint(data.events, byId["empty-cancelled-only"].filter), "category");
});

test("never returns inactive or sold-out events, even with no constraints", () => {
  const all = filterEvents(data.events, { date_range: { start: null, end: null }, price_max_thb: null, categories: [], party_size: null }, 1000);
  assert.ok(all.length > 0);
  assert.ok(all.every((e) => e.status === "active" && e.seats_remaining > 0));
});
