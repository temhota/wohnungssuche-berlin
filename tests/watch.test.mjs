import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createWatchState,
  baselineWatch,
  observeListings,
  readSeen,
  writeSeen,
  syncWatchProviders,
  restartWatch,
} from "../lib/watch/tracker.ts";
import { parseFilters } from "../lib/listings/filters.ts";
const filters = parseFilters({});
const row = (id, changes = {}) => ({
  id,
  provider: "HOWOGE",
  title: id,
  address: "Teststraße",
  district: "Mitte",
  warmRent: 800,
  area: 50,
  rooms: 2,
  wbs: null,
  features: [],
  href: "https://www.howoge.de/",
  ...changes,
});
const snapshot = (listings, source = {}) => ({
  listings,
  sources: [
    { provider: "HOWOGE", status: "ok", count: listings.length, ...source },
  ],
  fetchedAt: "2026-09-28T10:00:00Z",
});

test("start is silent; only new matching listings trigger once", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([row("1")]));
  assert.deepEqual(
    observeListings(state, snapshot([row("1"), row("2")]), filters).map(
      (item) => item.id,
    ),
    ["2"],
  );
  assert.deepEqual(
    observeListings(state, snapshot([row("1"), row("2")]), filters),
    [],
  );
});

test("nonmatching listings are remembered so changing filters does not alert", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([]));
  assert.deepEqual(
    observeListings(
      state,
      snapshot([row("1", { warmRent: 1200 })]),
      parseFilters({ maxRent: "900" }),
    ),
    [],
  );
  assert.deepEqual(
    observeListings(state, snapshot([row("1", { warmRent: 1200 })]), filters),
    [],
  );
});

test("disappeared and reappearing listings do not trigger again", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([row("1")]));
  observeListings(state, snapshot([]), filters);
  assert.deepEqual(observeListings(state, snapshot([row("1")]), filters), []);
});

test("new providers and initially unavailable sources establish a silent baseline", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([], { status: "error" }));
  assert.deepEqual(observeListings(state, snapshot([row("1")]), filters), []);
  assert.equal(
    observeListings(state, snapshot([row("1"), row("2")]), filters).length,
    1,
  );
  const added = {
    listings: [row("d1", { provider: "degewo" })],
    sources: [{ provider: "degewo", status: "ok", count: 1 }],
    fetchedAt: "",
  };
  assert.deepEqual(observeListings(state, added, filters), []);
});

test("stale and failed refreshes cannot trigger or consume new listings", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([row("1")]));
  for (const source of [
    { stale: true },
    { status: "error" },
    { error: "offline" },
  ]) {
    assert.deepEqual(
      observeListings(state, snapshot([row("2")], source), filters),
      [],
    );
  }
  assert.equal(observeListings(state, snapshot([row("2")]), filters).length, 1);
});

test("all pages are inspected and WBS, district and provider filters apply", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([]));
  const rows = Array.from({ length: 60 }, (_, i) =>
    row(String(i), { wbs: i === 59 ? null : "WBS erforderlich" }),
  );
  assert.deepEqual(
    observeListings(
      state,
      snapshot(rows),
      parseFilters({ excludeWbs: "1", district: "Mitte" }),
    ).map((item) => item.id),
    ["59"],
  );
});

test("seen IDs survive storage reload; malformed or blocked storage is safe", () => {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  assert.equal(writeSeen(storage, new Set(["1", "2"])), true);
  assert.deepEqual([...readSeen(storage).seen], ["1", "2"]);
  raw = "broken json";
  assert.equal(readSeen(storage).available, false);
  const blocked = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("full");
    },
  };
  assert.equal(readSeen(blocked).available, false);
  assert.equal(writeSeen(blocked, new Set()), false);
});

test("startup only initializes selected sources", () => {
  const state = createWatchState();
  baselineWatch(
    state,
    {
      listings: [row("1"), row("d1", { provider: "degewo" })],
      sources: [
        { provider: "HOWOGE", status: "ok", count: 1 },
        { provider: "degewo", status: "ok", count: 1 },
      ],
      fetchedAt: "",
    },
    ["HOWOGE"],
  );
  assert.equal(state.initialized.has("degewo"), false);
});

test("reselected providers establish a fresh silent baseline", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([row("1")]));
  syncWatchProviders(state, []);
  assert.deepEqual(
    observeListings(state, snapshot([row("1"), row("2")]), filters),
    [],
  );
  assert.deepEqual(
    observeListings(
      state,
      snapshot([row("1"), row("2"), row("3")]),
      filters,
    ).map((item) => item.id),
    ["3"],
  );
});

test("restart preserves session IDs even when storage is unavailable", () => {
  const state = createWatchState();
  baselineWatch(state, snapshot([]));
  assert.equal(observeListings(state, snapshot([row("1")]), filters).length, 1);
  const restarted = restartWatch(state, snapshot([]), ["HOWOGE"], []);
  assert.deepEqual(
    observeListings(restarted, snapshot([row("1")]), filters),
    [],
  );
});
