import { test } from "node:test";
import assert from "node:assert/strict";
import { getListings } from "../lib/listings/index.ts";
import {
  mergeResults,
  providersToRefresh,
} from "../lib/listings/client-data.ts";

const at = "2026-09-28T10:00:00.000Z";
const row = { id: "howoge-1", provider: "HOWOGE", warmRent: 800 };
const saved = {
  listings: [row],
  sources: [{ provider: "HOWOGE", status: "ok", count: 1, fetchedAt: at }],
  fetchedAt: at,
};

test("fresh loaded sources need no requests for filtering or pagination", () => {
  assert.deepEqual(
    providersToRefresh(saved, ["HOWOGE"], Date.parse(at) + 119_000),
    [],
  );
  assert.deepEqual(
    providersToRefresh(saved, ["HOWOGE", "degewo"], Date.parse(at) + 1_000),
    ["degewo"],
  );
  assert.deepEqual(
    providersToRefresh(saved, ["HOWOGE"], Date.parse(at) + 120_000),
    ["HOWOGE"],
  );
  assert.deepEqual(providersToRefresh(saved, [], Date.parse(at) + 120_000), []);
});

test("refresh failure preserves last successful rows and their timestamp", () => {
  const result = mergeResults(saved, {
    listings: [],
    sources: [
      { provider: "HOWOGE", status: "error", count: 0, error: "offline" },
    ],
    fetchedAt: "2026-09-28T10:03:00.000Z",
  });
  assert.deepEqual(result.listings, [row]);
  assert.equal(result.sources[0].fetchedAt, at);
  assert.equal(result.sources[0].stale, true);
  assert.equal(result.sources[0].error, "offline");
});

test("successful empty refresh removes obsolete rows, preserving other providers", () => {
  const result = mergeResults(
    {
      ...saved,
      listings: [
        ...saved.listings,
        { id: "degewo-1", provider: "degewo", warmRent: 600 },
      ],
    },
    {
      listings: [],
      sources: [
        {
          provider: "HOWOGE",
          status: "ok",
          count: 0,
          fetchedAt: "2026-09-28T10:03:00.000Z",
        },
      ],
      fetchedAt: "2026-09-28T10:03:00.000Z",
    },
  );
  assert.deepEqual(
    result.listings.map((row) => row.id),
    ["degewo-1"],
  );
});

test("cached aggregation preserves actual fetch time and reports stale snapshots", async () => {
  const result = await getListings(["HOWOGE"], async () => ({
    listings: [row],
    fetchedAt: at,
  }));
  assert.equal(result.fetchedAt, at);
  assert.equal(result.sources[0].fetchedAt, at);
  assert.equal(result.sources[0].stale, true);
});

test("provider aggregation carries provisional verification failures to the UI", async () => {
  const result = await getListings(["degewo"], async () => ({
    listings: [],
    fetchedAt: at,
    provisional: true,
    error: "direct offline",
  }));
  assert.equal(result.sources[0].provisional, true);
  assert.equal(result.sources[0].error, "direct offline");
});

test("provisional updates retain previous verified prices and missing listings", () => {
  const previous = {
    listings: [
      { id: "degewo-1", provider: "degewo", warmRent: 800 },
      { id: "degewo-2", provider: "degewo", warmRent: 600 },
    ],
    sources: [{ provider: "degewo", status: "ok", count: 2, fetchedAt: at }],
    fetchedAt: at,
  };
  const merged = mergeResults(previous, {
    listings: [
      { id: "degewo-1", provider: "degewo", warmRent: 1000, verified: false },
      { id: "degewo-3", provider: "degewo", warmRent: 700, verified: false },
    ],
    sources: [
      {
        provider: "degewo",
        status: "ok",
        count: 2,
        fetchedAt: "2026-09-28T10:03:00.000Z",
        provisional: true,
      },
    ],
    fetchedAt: "2026-09-28T10:03:00.000Z",
  });
  assert.deepEqual(
    merged.listings.map((x) => [x.id, x.warmRent]),
    [
      ["degewo-2", 600],
      ["degewo-3", 700],
      ["degewo-1", 800],
    ],
  );
  assert.equal(merged.sources[0].count, 3);
  assert.equal(merged.sources[0].fetchedAt, at);
  assert.equal(merged.sources[0].stale, true);
  const fallback = mergeResults(merged, {
    listings: [
      { id: "degewo-1", provider: "degewo", warmRent: 1000, verified: false },
    ],
    sources: [
      {
        provider: "degewo",
        status: "ok",
        count: 1,
        provisional: true,
        error: "direct offline",
        fetchedAt: "2026-09-28T10:03:00.000Z",
      },
    ],
    fetchedAt: "2026-09-28T10:03:00.000Z",
  });
  assert.deepEqual(
    fallback.listings
      .filter((x) => x.verified !== false)
      .map((x) => [x.id, x.warmRent]),
    [
      ["degewo-2", 600],
      ["degewo-1", 800],
    ],
  );
  assert.equal(fallback.sources[0].fetchedAt, at);
});
