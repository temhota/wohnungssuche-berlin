import type { Listing } from "./types";

const HOWOGE_ORIGIN = "https://www.howoge.de";
const HOWOGE_ENDPOINT = `${HOWOGE_ORIGIN}/?type=999&tx_howrealestate_json_list%5Baction%5D=immoList`;

type HowogeListing = {
  uid?: unknown;
  title?: unknown;
  district?: unknown;
  rent?: unknown;
  area?: unknown;
  rooms?: unknown;
  wbs?: unknown;
  features?: unknown;
  link?: unknown;
  notice?: unknown;
};

type HowogeResponse = {
  immoobjects?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(item: HowogeListing): Listing | null {
  const uid = number(item.uid);
  const address = text(item.title);
  const rooms = number(item.rooms);
  const area = number(item.area);
  const warmRent = number(item.rent);

  if (uid === null || !address || rooms === null || area === null || warmRent === null) {
    return null;
  }

  const link = text(item.link);
  const features = Array.isArray(item.features)
    ? item.features
        .map(text)
        .filter((feature) => feature && feature.toLowerCase() !== "wbs erforderlich")
    : [];

  return {
    id: `howoge-${uid}`,
    provider: "HOWOGE",
    title: text(item.notice) || "Wohnungsangebot",
    address,
    district: text(item.district) || null,
    rooms,
    area,
    warmRent,
    wbs: text(item.wbs).toLowerCase() === "ja" ? "WBS erforderlich" : null,
    features,
    href: link ? new URL(link, HOWOGE_ORIGIN).toString() : HOWOGE_ORIGIN,
  };
}

export async function fetchHowogeListings(): Promise<Listing[]> {
  const response = await fetch(HOWOGE_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "user-agent": "Kiezfinder/0.1 (+https://github.com/temhota/wohnungssuche-berlin)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`HOWOGE returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as HowogeResponse;
  if (!Array.isArray(payload.immoobjects)) {
    throw new Error("HOWOGE returned an unexpected response");
  }

  return payload.immoobjects
    .map((item) => normalize(item as HowogeListing))
    .filter((item): item is Listing => item !== null);
}
