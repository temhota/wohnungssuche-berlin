import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDegewoSnapshot } from "../lib/listings/degewo-snapshot.ts";

const at = "2026-10-13T10:00:00.000Z";
const fast = {
  listings: [
    { id: "degewo-1", provider: "degewo", warmRent: 1000, verified: false },
    { id: "degewo-2", provider: "degewo", warmRent: 600, verified: false },
  ],
  fetchedAt: at,
};
const direct = {
  listings: [
    { id: "degewo-1", provider: "degewo", warmRent: 800 },
    { id: "degewo-3", provider: "degewo", warmRent: 700 },
  ],
  fetchedAt: "2026-10-13T10:00:10.000Z",
};
const fail = async () => {
  throw new Error("offline");
};

test("completed degewo results supplement the fast source and prefer direct prices", async () => {
  const result = await loadDegewoSnapshot(
    async () => fast,
    async () => direct,
  );
  assert.deepEqual(
    result.listings.map((x) => [x.id, x.warmRent, x.verified]),
    [
      ["degewo-1", 800, undefined],
      ["degewo-2", 600, false],
      ["degewo-3", 700, undefined],
    ],
  );
  assert.equal(result.provisional, undefined);
  assert.equal(result.fetchedAt, at);
});

test("fast-only results are provisional and never request the direct source", async () => {
  const result = await loadDegewoSnapshot(
    async () => fast,
    () => assert.fail("direct fetch must not hold up the fast response"),
    true,
  );
  assert.equal(result.provisional, true);
  assert.equal(result.listings.length, 2);
});

test("either source can fail without discarding the other", async () => {
  assert.deepEqual(await loadDegewoSnapshot(fail, async () => direct), direct);
  const fallback = await loadDegewoSnapshot(async () => fast, fail);
  assert.equal(fallback.listings.length, 2);
  assert.equal(fallback.provisional, true);
  assert.match(fallback.error, /offline/);
  await assert.rejects(loadDegewoSnapshot(fail, fail), /offline/);
});
