import type { Listing } from "./types";

const GESOBAU_ORIGIN = "https://www.gesobau.de";
const GESOBAU_ENDPOINT = new URL("/mieten/wohnungssuche/", GESOBAU_ORIGIN);

GESOBAU_ENDPOINT.searchParams.set("resultsPerPage", "10000");
GESOBAU_ENDPOINT.searchParams.set("resultsPage", "0");
GESOBAU_ENDPOINT.searchParams.set("resultAsJSON", "1");
GESOBAU_ENDPOINT.searchParams.append(
  "befilter[0]",
  "nutzungsart_stringS:WOHNEN",
);
GESOBAU_ENDPOINT.searchParams.append(
  "befilter[1]",
  'kanal_stringM:("Service" OR "Senioren Kachel" OR "Bestand" OR "Studierende" OR "Neubau Kachel")',
);

type GesobauRaw = {
  uid?: unknown;
  title?: unknown;
  url?: unknown;
  adresse_stringS?: unknown;
  ort_stringS?: unknown;
  plz_stringS?: unknown;
  region_stringM?: unknown;
  location_stringM?: unknown;
  zimmer_intS?: unknown;
  wohnflaeche_floatS?: unknown;
  warmmiete_floatS?: unknown;
  sozialwohnung_boolS?: unknown;
  barrierefrei_boolS?: unknown;
  rollstuhlgerecht_boolS?: unknown;
  balkonFacette_boolS?: unknown;
  terrasse_boolS?: unknown;
  wanne_boolS?: unknown;
  ebk_boolS?: unknown;
  fahrstuhl_boolS?: unknown;
  gartennutzung_boolS?: unknown;
  keller_boolS?: unknown;
  fuerSenioren_boolS?: unknown;
  fuerStudierende_boolS?: unknown;
};

type GesobauItem = {
  uid?: unknown;
  detail?: unknown;
  raw?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstText(value: unknown): string {
  return Array.isArray(value) ? text(value[0]) : text(value);
}

function normalize(value: unknown): Listing | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as GesobauItem;
  if (!item.raw || typeof item.raw !== "object") return null;

  const raw = item.raw as GesobauRaw;
  const uid = number(raw.uid ?? item.uid);
  const title = text(raw.title);
  const street = text(raw.adresse_stringS);
  const postcode = text(raw.plz_stringS);
  const city = text(raw.ort_stringS);
  const rooms = number(raw.zimmer_intS);
  const area = number(raw.wohnflaeche_floatS);
  const warmRent = number(raw.warmmiete_floatS);
  const href = text(raw.url) || text(item.detail);

  if (
    uid === null ||
    !title ||
    !street ||
    rooms === null ||
    area === null ||
    warmRent === null ||
    !href
  ) {
    return null;
  }

  const featureFlags: Array<[unknown, string]> = [
    [raw.barrierefrei_boolS, "Barrierefrei"],
    [raw.rollstuhlgerecht_boolS, "Rollstuhlgerecht"],
    [raw.balkonFacette_boolS, "Balkon/Loggia"],
    [raw.terrasse_boolS, "Terrasse"],
    [raw.wanne_boolS, "Badewanne"],
    [raw.ebk_boolS, "Einbauküche"],
    [raw.fahrstuhl_boolS, "Aufzug"],
    [raw.gartennutzung_boolS, "Gartennutzung"],
    [raw.keller_boolS, "Keller"],
    [raw.fuerSenioren_boolS, "Für Senior*innen"],
    [raw.fuerStudierende_boolS, "Für Studierende"],
  ];

  return {
    id: `gesobau-${uid}`,
    provider: "GESOBAU",
    title,
    address: [street, [postcode, city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    district:
      firstText(raw.region_stringM) || firstText(raw.location_stringM) || null,
    rooms,
    area,
    warmRent,
    wbs: raw.sozialwohnung_boolS === true ? "WBS erforderlich" : null,
    features: featureFlags
      .filter(([enabled]) => enabled === true)
      .map(([, label]) => label),
    href: new URL(href, GESOBAU_ORIGIN).toString(),
  };
}

export async function fetchGesobauListings(): Promise<Listing[]> {
  const response = await fetch(GESOBAU_ENDPOINT, {
    headers: {
      accept: "application/json",
      "user-agent":
        "Kiezfinder/0.1 (+https://github.com/temhota/wohnungssuche-berlin)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`GESOBAU returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("GESOBAU returned an unexpected response");
  }

  return payload
    .map(normalize)
    .filter((item): item is Listing => item !== null);
}
