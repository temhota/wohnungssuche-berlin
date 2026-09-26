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
