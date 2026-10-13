import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWohnungsfinderDegewoListings } from "../lib/listings/wohnungsfinder.ts";

const arr = (value) => [value, { s: "arr" }];
const component = (name, data) => ({
  memo: { name },
  data,
  checksum: "fixture",
});
const node = (snapshot) =>
  `<div wire:snapshot="${JSON.stringify(snapshot).replaceAll('"', "&quot;")}"></div>`;
const root = (ids) =>
  component("apartment-finder.rentable-apartment-finder", {
    itemIds: arr(ids),
    itemsPerPage: 100,
    paginators: arr({ page: 1 }),
  });
function item(id, changes = {}) {
  return component("apartment-finder.item.apartment-item", {
    item: arr({
      title: "Wohnung mit WBS 180",
      objectId: `W${id}`,
      deeplink: `https://www.degewo.de/de/properties/W${id}.html`,
      rooms: "2,0",
      area: "50,40",
      rentGross: 349.24,
      company: arr({ id: 1, intern: "degewo" }),
      address: arr({
        street: "Teststraße",
        number: "2",
        zipCode: "12345",
        district: "Mitte",
      }),
      details: arr([
        arr([
          { label: "Gesamtmiete", value: "404,33" },
          { label: "WBS", value: "erforderlich" },
        ]),
      ]),
      ...changes,
    }),
  });
}
function update(ids, items) {
  return Response.json({
    components: [
      {
        snapshot: JSON.stringify(root(ids)),
        effects: { html: items.map(node).join("") },
      },
    ],
    assets: {},
  });
}
function initial() {
  return new Response(
    `<meta name="csrf-token" content="anonymous-token">${node(root([1, 2]))}`,
    {
      headers: { "set-cookie": "session=anonymous; HttpOnly; Path=/" },
    },
  );
}

test("Wohnungsfinder yields original IDs, total warm rent and WBS without login", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (options.method !== "POST") return initial();
    assert.equal(url, "https://www.inberlinwohnen.de/livewire/update");
    assert.match(options.headers.cookie, /session=anonymous/);
    const body = JSON.parse(options.body);
    assert.equal(body._token, "anonymous-token");
    assert.deepEqual(body.components[0].calls[0].params, [
      "filterBy",
      { filterName: "company", value: "1" },
    ]);
    return update(
      [1, 2],
      [
        item(1),
        item(2, {
          title: "Wohnung ohne WBS",
          details: arr([
            arr([
              { label: "Gesamtmiete", value: "404,33" },
              { label: "WBS", value: "nicht erforderlich" },
            ]),
          ]),
        }),
      ],
    );
  });
  const rows = await fetchWohnungsfinderDegewoListings();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    id: "degewo-W1",
    provider: "degewo",
    title: "Wohnung mit WBS 180",
    address: "Teststraße 2",
    district: "Mitte",
    rooms: 2,
    area: 50.4,
    warmRent: 404.33,
    wbs: "WBS 180",
    features: [],
    href: "https://www.degewo.de/de/properties/W1.html",
    verified: false,
  });
  assert.equal(rows[1].wbs, null);
});

test("Wohnungsfinder follows additional pages if the requested page size is capped", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, options) => {
    if (options.method !== "POST") return initial();
    const call = JSON.parse(options.body).components[0].calls[0];
    if (call.params[0] === "filterBy") {
      const result = await update([1, 2], [item(1)]).json();
      const snapshot = root([1, 2]);
      snapshot.data.itemsPerPage = 1;
      result.components[0].snapshot = JSON.stringify(snapshot);
      return Response.json(result);
    }
    assert.deepEqual(call.params, ["gotoPage", { page: 2 }]);
    return update([1, 2], [item(2)]);
  });
  assert.deepEqual(
    (await fetchWohnungsfinderDegewoListings()).map((x) => x.id),
    ["degewo-W1", "degewo-W2"],
  );
});

test("Wohnungsfinder rejects incomplete, invalid or mixed-provider responses", async (t) => {
  const scenarios = [
    () => update([1, 2], [item(1)]),
    () =>
      update([1], [item(1, { company: arr({ id: 2, intern: "GESOBAU" }) })]),
    () => update([1], [item(1, { rooms: "", area: null })]),
    () => update([1], [item(1, { deeplink: "https://unrelated.example/" })]),
    () => new Response("Oops, an error occurred!"),
    () => new Response("Unavailable", { status: 503 }),
  ];
  for (const response of scenarios) {
    t.mock.method(globalThis, "fetch", async (_, options) =>
      options.method === "POST" ? response() : initial(),
    );
    await assert.rejects(fetchWohnungsfinderDegewoListings());
    t.mock.restoreAll();
  }
});

test("a valid empty degewo search is accepted", async (t) => {
  t.mock.method(globalThis, "fetch", async (_, options) =>
    options.method === "POST" ? update([], []) : initial(),
  );
  assert.deepEqual(await fetchWohnungsfinderDegewoListings(), []);
});
