import { load } from "cheerio";
import type { Listing } from "./types";

const DEGEWO_ORIGIN = "https://www.degewo.de";
const DEGEWO_ENDPOINT = `${DEGEWO_ORIGIN}/immosuche`;

const searchParams = new URLSearchParams({
  "tx_openimmo_immobilie[distance]": "5",
  "tx_openimmo_immobilie[search]": "search",
  "tx_openimmo_immobilie[wohnflaeche_end]": "9999",
  "tx_openimmo_immobilie[anzahlZimmer_end]": "9999",
  "tx_openimmo_immobilie[sortBy]": "immobilie_preise_warmmiete",
  "tx_openimmo_immobilie[sr][marketingType]": "MIETE_PACHT",
  "tx_openimmo_immobilie[sr][objectTypes]": "wohnung",
  "tx_openimmo_immobilie[warmmiete_start]": "0",
});

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function germanNumber(value: string): number | null {
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return normalized && Number.isFinite(parsed) ? parsed : null;
}

export async function fetchDegewoListings(): Promise<Listing[]> {
  const response = await fetch(DEGEWO_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Kiezfinder/0.1 (+https://github.com/temhota/wohnungssuche-berlin)",
    },
    body: searchParams,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`degewo returned HTTP ${response.status}`);
  }

  const $ = load(await response.text());
  const listings: Listing[] = [];

  $(".c-teaser--apartment").each((_, element) => {
    const card = $(element);
    const link = card.find("h3 a").first();
    const title = clean(link.text());
    const href = link.attr("href") ?? "";
    const id = card.find("[data-openimmo-bookmark-item-uid]").attr("data-openimmo-bookmark-item-uid") ?? href;
    const location = clean(card.find(".c-copy > p").first().text());
    const [address, district] = location.split("|").map(clean);
    const features = card
      .find(".c-tag__label")
      .map((__, feature) => clean($(feature).text()))
      .get()
      .filter((feature) => feature && !feature.toLowerCase().includes("wbs"));

    const facts = new Map<string, string>();
    card.find(".c-definition-list__item").each((__, fact) => {
      const item = $(fact);
      facts.set(clean(item.find("dd").text()).toLowerCase(), clean(item.find("dt").text()));
    });

    const warmRent = germanNumber(facts.get("warmmiete") ?? "");
    const rooms = germanNumber(facts.get("zimmer") ?? "");
    const area = germanNumber(facts.get("m²") ?? "");

    if (!id || !title || !address || !href || warmRent === null || rooms === null || area === null) {
      return;
    }

    const wbsText = `${title} ${card.text()}`.match(/WBS(?:\s+[\d/-]+)?/i)?.[0] ?? null;

    listings.push({
      id: `degewo-${id}`,
      provider: "degewo",
      title,
      address,
      district: district || null,
      rooms,
      area,
      warmRent,
      wbs: wbsText ? clean(wbsText).toUpperCase() : null,
      features,
      href: new URL(href, DEGEWO_ORIGIN).toString(),
    });
  });

  if ($(".c-teaser--apartment").length > 0 && listings.length === 0) {
    throw new Error("degewo returned an unexpected response");
  }

  return listings;
}
