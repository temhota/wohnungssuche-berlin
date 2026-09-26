import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchHowogeListings } from '../lib/listings/howoge.ts';
import { fetchGesobauListings } from '../lib/listings/gesobau.ts';
import { fetchDegewoListings } from '../lib/listings/degewo.ts';

const howoge = { uid: 1, title: 'Teststraße 1', rooms: 2, area: 50, rent: 800, link: '/wohnung/1', wbs: 'nein', features: [] };
const gesobau = { uid: 1, title: 'Wohnung', adresse_stringS: 'Teststraße 1', zimmer_intS: 2, wohnflaeche_floatS: 50, warmmiete_floatS: 800, url: '/wohnung/1' };
const adapters = [
  { name: 'HOWOGE', fetch: fetchHowogeListings, row: howoge, fields: ['rooms', 'area', 'rent'], wrap: rows => ({ immoobjects: rows }) },
  { name: 'GESOBAU', fetch: fetchGesobauListings, row: gesobau, fields: ['zimmer_intS', 'wohnflaeche_floatS', 'warmmiete_floatS'], wrap: rows => rows.map(raw => raw === null ? null : { raw }) },
];
for (const adapter of adapters) {
  test(`${adapter.name} skips missing numeric values without losing valid listings`, async t => {
    const rows = [adapter.row];
    for (const field of adapter.fields) {
      for (const value of [null, '', ' ', false, [], {}, -1]) rows.push({ ...adapter.row, [field]: value });
    }
    t.mock.method(globalThis, 'fetch', async () => Response.json(adapter.wrap(rows)));
    const listings = await adapter.fetch();
    assert.equal(listings.length, 1);
    assert.equal(listings[0].warmRent, 800);
  });
  test(`${adapter.name} keeps good rows around null records`, async t => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(adapter.wrap([null, adapter.row, null])));
    assert.equal((await adapter.fetch()).length, 1);
  });
  test(`${adapter.name} accepts numeric strings`, async t => {
    const row = { ...adapter.row };
    for (const field of adapter.fields) row[field] = String(row[field]);
    t.mock.method(globalThis, 'fetch', async () => Response.json(adapter.wrap([row])));
    assert.equal((await adapter.fetch())[0].warmRent, 800);
  });
}
function card(id, title = 'Wohnung') {
  return `<article class="c-teaser--apartment"><h3><a href="/wohnung/${id}">${title}</a></h3><div data-openimmo-bookmark-item-uid="${id}"></div><div class="c-copy"><p>Teststraße ${id} | Mitte</p></div><div class="c-definition-list__item"><dt>800,00 €</dt><dd>Warmmiete</dd></div><div class="c-definition-list__item"><dt>2</dt><dd>Zimmer</dd></div><div class="c-definition-list__item"><dt>50</dt><dd>m²</dd></div></article>`;
}
const pageLink = page => `<a href="/immosuche?tx_openimmo_immobilie%5Bpage%5D=${page}&tx_openimmo_immobilie%5Bsearch%5D=paginate#immo-teaser-list">Seite ${page}</a>`;
test('degewo follows pagination and deduplicates listings and page links', async t => {
  const pages = new Map([
    [1, card(1) + pageLink(2) + pageLink(3) + pageLink(2)],
    [2, card(1) + card(2) + pageLink(3)],
    [3, card(3) + pageLink(2)],
  ]);
  t.mock.method(globalThis, 'fetch', async (url) => {
    const page = Number(new URL(url).searchParams.get('tx_openimmo_immobilie[page]') || 1);
    assert.ok(pages.has(page), 'page must be requested once');
    const html = pages.get(page);
    pages.delete(page);
    return new Response(html);
  });
  const listings = await fetchDegewoListings();
  assert.deepEqual(listings.map(item => item.id).sort(), ['degewo-1', 'degewo-2', 'degewo-3']);
});
test('degewo distinguishes WBS requirements from negation', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(
    card(1, 'Wohnung ohne WBS') + card(2, 'Kein WBS erforderlich') + card(3, 'WBS nicht erforderlich') + card(4, 'Mit WBS 180')
  ));
  assert.deepEqual((await fetchDegewoListings()).map(item => item.wbs), [null, null, null, 'WBS 180']);
});
test('degewo reports a failed later page instead of presenting a complete result', async t => {
  t.mock.method(globalThis, 'fetch', async url => new URL(url).search
    ? new Response('Unavailable', { status: 503 })
    : new Response(card(1) + pageLink(2)));
  await assert.rejects(fetchDegewoListings(), /503/);
});
