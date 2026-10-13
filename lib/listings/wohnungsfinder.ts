import { load } from "cheerio";
import type { Listing } from "./types";

const ORIGIN = "https://www.inberlinwohnen.de";
const FINDER = "apartment-finder.rentable-apartment-finder";
const ITEM = "apartment-finder.item.apartment-item";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// Livewire wraps arrays and objects with serialization metadata.
function unwrap(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 2 && record(value[1]).s === "arr")
      return unwrap(value[0]);
    return value.map(unwrap);
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, unwrap(item)]),
    );
  return value;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function number(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 ? value : null;
  if (
    typeof value !== "string" ||
    !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(value.trim())
  )
    return null;
  const parsed = Number(value.trim().replaceAll(".", "").replace(",", "."));
  return parsed > 0 ? parsed : null;
}

function readSnapshot(snapshot: string) {
  const parsed = record(JSON.parse(snapshot));
  return { name: record(parsed.memo).name, data: record(unwrap(parsed.data)) };
}

export async function fetchWohnungsfinderDegewoListings(): Promise<Listing[]> {
  const signal = AbortSignal.timeout(15_000);
  const cookies = new Map<string, string>();
  async function request(url: string, body?: object) {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        accept: body ? "application/json" : "text/html",
        ...(body
          ? {
              "content-type": "application/json",
              "x-livewire": "",
              origin: ORIGIN,
              referer: `${ORIGIN}/wohnungsfinder`,
            }
          : {}),
        ...(cookies.size
          ? {
              cookie: [...cookies]
                .map(([key, value]) => `${key}=${value}`)
                .join("; "),
            }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
    if (!response.ok)
      throw new Error(`Wohnungsfinder returned HTTP ${response.status}`);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator > 0)
        cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }

  const initial = load(
    await (await request(`${ORIGIN}/wohnungsfinder`)).text(),
  );
  const token = initial('meta[name="csrf-token"]').attr("content");
  let snapshot = initial("[wire\\:snapshot]")
    .map((_, element) => initial(element).attr("wire:snapshot")!)
    .get()
    .find((value) => readSnapshot(value).name === FINDER);
  if (!token || !snapshot)
    throw new Error("Wohnungsfinder returned an unexpected search page");

  const listings = new Map<string, Listing>();
  let expected: number | undefined;
  let pageSize = 100;
  async function update(event: string, params: object, first = false) {
    const response = await request(`${ORIGIN}/livewire/update`, {
      _token: token,
      components: [
        {
          snapshot,
          updates: first ? { itemsPerPage: 100 } : {},
          calls: [{ path: "", method: "__dispatch", params: [event, params] }],
        },
      ],
    });
    const payload = record(await response.json());
    const component = record(
      Array.isArray(payload.components) ? payload.components[0] : null,
    );
    if (typeof component.snapshot !== "string")
      throw new Error("Wohnungsfinder returned an unexpected search response");
    snapshot = component.snapshot;
    const root = readSnapshot(snapshot);
    if (
      root.name !== FINDER ||
      !Array.isArray(root.data.itemIds) ||
      !Number.isInteger(root.data.itemsPerPage) ||
      Number(root.data.itemsPerPage) < 1
    )
      throw new Error("Wohnungsfinder returned invalid pagination");
    const count = root.data.itemIds.length;
    if (expected !== undefined && expected !== count)
      throw new Error("Wohnungsfinder results changed during pagination");
    expected = count;
    pageSize = Number(root.data.itemsPerPage);
    const html = record(component.effects).html;
    if (typeof html !== "string")
      throw new Error("Wohnungsfinder returned no listing content");
    const $ = load(html);
    $("[wire\\:snapshot]").each((_, element) => {
      const decoded = readSnapshot($(element).attr("wire:snapshot")!);
      if (decoded.name !== ITEM) return;
      const item = record(decoded.data.item);
      const company = record(item.company);
      const address = record(item.address);
      const details = Array.isArray(item.details)
        ? item.details.flat(2).map(record)
        : [];
      const rent = details.find((detail) => detail.label === "Gesamtmiete");
      const warmRent = number(rent?.value);
      const rooms = number(item.rooms);
      const area = number(item.area);
      const id = clean(item.objectId);
      const title = clean(item.title);
      const street = clean(address.street);
      const href = new URL(clean(item.deeplink));
      if (
        company.id !== 1 ||
        company.intern !== "degewo" ||
        href.origin !== "https://www.degewo.de" ||
        !id ||
        !title ||
        !street ||
        warmRent === null ||
        rooms === null ||
        area === null
      )
        throw new Error("Wohnungsfinder returned an invalid degewo listing");
      const wbsDetail = clean(
        details.find((detail) => detail.label === "WBS")?.value,
      );
      const noWbs =
        /\b(?:ohne|kein(?:en)?)\s+WBS\b|\bWBS\s+(?:ist\s+)?nicht\s+(?:erforderlich|notwendig|nötig)\b/i.test(
          title,
        ) || /nicht erforderlich/i.test(wbsDetail);
      const wbs = noWbs
        ? null
        : (title.match(/\bWBS(?:\s+[\d/-]+)?/i)?.[0]?.toUpperCase() ??
          (/erforderlich/i.test(wbsDetail) ? "WBS erforderlich" : null));
      const features: string[] = [];
      $(element)
        .find("[wire\\:snapshot]")
        .each((__, child) => {
          if (
            readSnapshot($(child).attr("wire:snapshot")!).name ===
            "apartment-finder.item.partials.attributes-list"
          ) {
            $(child)
              .find("span")
              .each((___, span) => {
                const label = clean($(span).text());
                if (label && !/wbs/i.test(label)) features.push(label);
              });
          }
        });
      listings.set(id, {
        id: `degewo-${id}`,
        provider: "degewo",
        title,
        address: clean(`${street} ${clean(address.number)}`),
        district: clean(address.district) || null,
        rooms,
        area,
        warmRent,
        wbs,
        features: [...new Set(features)],
        href: href.toString(),
        verified: false,
      });
    });
  }

  await update("filterBy", { filterName: "company", value: "1" }, true);
  const pages = Math.ceil(expected! / pageSize);
  if (pages > 100)
    throw new Error("Wohnungsfinder pagination exceeded the page limit");
  for (let page = 2; page <= pages; page++) await update("gotoPage", { page });
  if (listings.size !== expected)
    throw new Error("Wohnungsfinder returned an incomplete degewo search");
  return [...listings.values()];
}
