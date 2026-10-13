import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { refreshListings } from "../lib/listings/refresh.ts";
import { mergeResults } from "../lib/listings/client-data.ts";

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function snapshot(provider, listings = []) {
  return {
    listings,
    sources: [
      {
        provider,
        status: "ok",
        count: listings.length,
        fetchedAt: "2026-10-13T10:00:00.000Z",
      },
    ],
    fetchedAt: "2026-10-13T10:00:00.000Z",
  };
}

test("fast provider results are published before a slow provider finishes", async (t) => {
  const slow = deferred();
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const providers = new URL(url, "http://localhost").searchParams.getAll(
      "provider",
    );
    requests.push(providers);
    assert.equal(options.cache, "no-store");
    assert.equal(options.signal, controller.signal);
    assert.equal(providers.length, 1);
    return providers[0] === "degewo"
      ? slow.promise
      : Response.json(
          snapshot("HOWOGE", [
            { id: "howoge-1", provider: "HOWOGE", warmRent: 800 },
          ]),
        );
  });
  const controller = new AbortController();
  let result = snapshot("degewo");
  const updates = [];
  const work = refreshListings(
    ["degewo", "HOWOGE"],
    controller.signal,
    (incoming) => {
      updates.push(incoming.sources[0].provider);
      result = mergeResults(result, incoming);
    },
  );
  await setImmediate();
  assert.deepEqual(requests, [["degewo"], ["degewo"], ["HOWOGE"]]);
  assert.deepEqual(updates, ["HOWOGE"]);
  assert.equal(result.listings[0].id, "howoge-1");
  slow.resolve(
    Response.json(
      snapshot("degewo", [
        { id: "degewo-1", provider: "degewo", warmRent: 600 },
      ]),
    ),
  );
  await work;
  assert.deepEqual(updates, ["HOWOGE", "degewo"]);
  assert.deepEqual(
    result.listings.map((row) => row.id),
    ["degewo-1", "howoge-1"],
  );
});

test("provisional degewo results arrive while direct verification is pending", async (t) => {
  const direct = deferred();
  const provisional = snapshot("degewo", [
    { id: "degewo-1", provider: "degewo", warmRent: 1000, verified: false },
  ]);
  provisional.sources[0].provisional = true;
  t.mock.method(globalThis, "fetch", async (url) =>
    new URL(url, "http://localhost").searchParams.get("degewo") === "quick"
      ? Response.json(provisional)
      : direct.promise,
  );
  const updates = [];
  const work = refreshListings(
    ["degewo"],
    new AbortController().signal,
    (incoming) => updates.push(incoming),
  );
  await setImmediate();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].sources[0].provisional, true);
  direct.resolve(
    Response.json(
      snapshot("degewo", [
        { id: "degewo-1", provider: "degewo", warmRent: 800 },
      ]),
    ),
  );
  await work;
  assert.equal(updates.length, 2);
  assert.equal(updates[1].listings[0].warmRent, 800);
  assert.equal(updates[1].sources[0].provisional, undefined);
});

test("a late fast response cannot overwrite a completed direct check", async (t) => {
  const quick = deferred();
  t.mock.method(globalThis, "fetch", async (url) =>
    new URL(url, "http://localhost").searchParams.has("degewo")
      ? quick.promise
      : Response.json(snapshot("degewo")),
  );
  const updates = [];
  const work = refreshListings(
    ["degewo"],
    new AbortController().signal,
    (incoming) => updates.push(incoming),
  );
  await setImmediate();
  assert.equal(updates.length, 1);
  const provisional = snapshot("degewo");
  provisional.sources[0].provisional = true;
  quick.resolve(Response.json(provisional));
  await work;
  assert.equal(updates.length, 1);
  assert.equal(updates[0].sources[0].provisional, undefined);
});

test("a late quick response survives a failed full request and reports failed verification", async (t) => {
  const quick = deferred();
  t.mock.method(globalThis, "fetch", async (url) => {
    if (new URL(url, "http://localhost").searchParams.has("degewo"))
      return quick.promise;
    throw new Error("offline");
  });
  const updates = [];
  const work = refreshListings(
    ["degewo"],
    new AbortController().signal,
    (incoming) => updates.push(incoming),
  );
  await setImmediate();
  const provisional = snapshot("degewo", [
    { id: "degewo-1", provider: "degewo", warmRent: 800, verified: false },
  ]);
  provisional.sources[0].provisional = true;
  quick.resolve(Response.json(provisional));
  await work;
  assert.equal(updates.at(-1).listings.length, 1);
  assert.equal(updates.at(-1).sources[0].provisional, true);
  assert.ok(updates.at(-1).sources[0].error);
});

test("a failing provider does not discard successful provider results", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const provider = new URL(url, "http://localhost").searchParams.get(
      "provider",
    );
    if (provider === "degewo") throw new Error("Offline");
    return Response.json(
      snapshot(provider, [{ id: "howoge-1", provider, warmRent: 800 }]),
    );
  });
  const updates = [];
  await refreshListings(
    ["HOWOGE", "degewo"],
    new AbortController().signal,
    (result) => updates.push(result),
  );
  assert.equal(
    updates.find((result) => result.sources[0].provider === "HOWOGE").listings
      .length,
    1,
  );
  assert.equal(
    updates.find((result) => result.sources[0].provider === "degewo").sources[0]
      .status,
    "error",
  );
});

test("aborted requests cannot publish results after navigation", async (t) => {
  const response = deferred();
  t.mock.method(globalThis, "fetch", () => response.promise);
  const controller = new AbortController();
  const updates = [];
  const work = refreshListings(["HOWOGE"], controller.signal, (result) =>
    updates.push(result),
  );
  controller.abort();
  response.resolve(Response.json(snapshot("HOWOGE")));
  await work;
  assert.deepEqual(updates, []);
});

test("provider error responses and malformed responses remain isolated", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const provider = new URL(url, "http://localhost").searchParams.get(
      "provider",
    );
    if (provider === "HOWOGE")
      return Response.json(
        {
          listings: [],
          sources: [
            {
              provider,
              status: "error",
              count: 0,
              error: "HOWOGE unavailable",
            },
          ],
          fetchedAt: "2026-10-13T10:00:00.000Z",
        },
        { status: 502 },
      );
    if (provider === "degewo")
      return new Response("Unavailable", { status: 503 });
    return new Response("Not JSON");
  });
  const updates = [];
  await refreshListings(
    ["HOWOGE", "degewo", "GESOBAU"],
    new AbortController().signal,
    (result) => updates.push(result),
  );
  assert.equal(updates.length, 3);
  assert.ok(updates.every((result) => result.sources[0].status === "error"));
  assert.equal(
    updates.find((result) => result.sources[0].provider === "HOWOGE").sources[0]
      .error,
    "HOWOGE unavailable",
  );
});
