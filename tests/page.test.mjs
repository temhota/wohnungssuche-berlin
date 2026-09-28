import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../app/page.tsx";

test("page exposes unavailable providers while keeping successful listings", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) =>
    String(url).includes("howoge")
      ? Response.json({
          immoobjects: [
            { uid: 1, title: "Teststraße 1", rooms: 2, area: 50, rent: 800 },
          ],
        })
      : new Response("Unavailable", { status: 503 }),
  );
  const html = renderToStaticMarkup(await Home());
  assert.match(html, /Teststraße 1/);
  assert.match(html, /Nicht erreichbar: degewo, GESOBAU/);
  assert.match(html, /unvollständig/);
});
test("page formats update time in Berlin regardless of server timezone", async (t) => {
  const previous = process.env.TZ;
  process.env.TZ = "Pacific/Honolulu";
  t.after(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("Unavailable", { status: 503 }),
  );
  const before = new Date();
  const html = renderToStaticMarkup(await Home());
  const after = new Date();
  const format = (date) =>
    date.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  assert.ok(
    html.includes(format(before)) || html.includes(format(after)),
    html,
  );
});
test("page distinguishes an empty successful search from a loading error", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) =>
    String(url).includes("howoge")
      ? Response.json({ immoobjects: [] })
      : String(url).includes("gesobau")
        ? Response.json([])
        : new Response("0 Ergebnisse"),
  );
  const html = renderToStaticMarkup(await Home());
  assert.match(html, /Aktuell sind keine Wohnungsangebote verfügbar/);
  assert.doesNotMatch(html, /konnten gerade nicht geladen werden/);
});

function mockListings(t, count) {
  t.mock.method(globalThis, "fetch", async (url) =>
    String(url).includes("howoge")
      ? Response.json({
          immoobjects: Array.from({ length: count }, (_, index) => ({
            uid: index + 1,
            title: `Wohnung ${index + 1}`,
            notice: `Wohnung ${index + 1}`,
            rooms: 2,
            area: 50,
            rent: 800 + index,
          })),
        })
      : String(url).includes("gesobau")
        ? Response.json([])
        : new Response("0 Ergebnisse"),
  );
}

for (const [page, count, first, last, previous, next] of [
  [undefined, 50, 1, 50, false, true],
  ["2", 50, 51, 100, true, true],
  ["3", 1, 101, 101, true, false],
  ["999", 1, 101, 101, true, false],
  ["invalid", 50, 1, 50, false, true],
  ["-1", 50, 1, 50, false, true],
  ["1.5", 50, 1, 50, false, true],
  [["2", "3"], 50, 1, 50, false, true],
]) {
  test(`pagination renders the correct listings for page ${JSON.stringify(page)}`, async (t) => {
    mockListings(t, 101);
    const html = renderToStaticMarkup(
      await Home({ searchParams: Promise.resolve({ page }) }),
    );
    assert.equal((html.match(/<article/g) || []).length, count);
    const titles = [...html.matchAll(/<h2>Wohnung (\d+)<\/h2>/g)].map((match) =>
      Number(match[1]),
    );
    assert.deepEqual(
      titles,
      Array.from({ length: count }, (_, index) => first + index),
    );
    assert.equal(titles.at(-1), last);
    assert.match(html, /101 Angebote/);
    const current = Math.ceil(first / 50);
    assert.match(html, new RegExp(`Seite ${current} von 3`));
    assert.equal(/rel="prev"/.test(html), previous);
    assert.equal(/rel="next"/.test(html), next);
    if (previous) assert.ok(html.includes(`href="?page=${current - 1}"`));
    if (next) assert.ok(html.includes(`href="?page=${current + 1}"`));
  });
}

for (const count of [0, 50]) {
  test(`pagination is hidden for ${count} listings`, async (t) => {
    mockListings(t, count);
    const html = renderToStaticMarkup(await Home());
    assert.equal((html.match(/<article/g) || []).length, count);
    assert.doesNotMatch(html, /aria-label="Seitennavigation"/);
  });
}
