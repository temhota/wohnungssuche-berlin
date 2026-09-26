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

function parsePage(html: string) {
  const $ = load(html);
  const listings: Listing[] = [];

  $(".c-teaser--apartment").each((_, element) => {
    const card = $(element);
    const link = card.find("h3 a").first();
    const title = clean(link.text());
    const href = link.attr("href") ?? "";
    const id =
      card
        .find("[data-openimmo-bookmark-item-uid]")
        .attr("data-openimmo-bookmark-item-uid") ?? href;
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
      facts.set(
        clean(item.find("dd").text()).toLowerCase(),
        clean(item.find("dt").text()),
      );
    });

    const warmRent = germanNumber(facts.get("warmmiete") ?? "");
    const rooms = germanNumber(facts.get("zimmer") ?? "");
    const area = germanNumber(facts.get("m²") ?? "");

    if (
      !id ||
      !title ||
      !address ||
      !href ||
      warmRent === null ||
      rooms === null ||
      area === null
    ) {
      return;
    }

    const description = clean(`${title} ${card.text()}`);
    const withoutWbs =
      /\b(?:ohne|kein(?:en)?)\s+WBS\b|\bWBS\s+(?:ist\s+)?nicht\s+(?:erforderlich|notwendig|nötig)\b/i.test(
        description,
      );
    const wbsText = withoutWbs
      ? null
      : (description.match(/\bWBS(?:\s+[\d/-]+)?/i)?.[0] ?? null);

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

  const pages = new Map<number, string>();
  $("a[href]").each((_, element) => {
    try {
      const url = new URL($(element).attr("href")!, DEGEWO_ORIGIN);
      const page = Number(url.searchParams.get("tx_openimmo_immobilie[page]"));
      if (
        url.origin === DEGEWO_ORIGIN &&
        url.pathname === "/immosuche" &&
        Number.isInteger(page) &&
        page > 1
      ) {
        url.hash = "";
        pages.set(page, url.toString());
      }
    } catch {
      // Ignore malformed navigation links from the remote document.
    }
  });
  return { listings, pages };
}

export async function fetchDegewoListings(): Promise<Listing[]> {
  const signal = AbortSignal.timeout(20_000);
  const headers = {
    accept: "text/html",
    "user-agent":
      "Kiezfinder/0.1 (+https://github.com/temhota/wohnungssuche-berlin)",
  };
  async function fetchPage(url: string, initial = false) {
    const response = await fetch(url, {
      method: initial ? "POST" : "GET",
      headers: initial
        ? {
            ...headers,
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          }
        : headers,
      body: initial ? searchParams : undefined,
      cache: "no-store",
      signal,
    });
    if (!response.ok)
      throw new Error(`degewo returned HTTP ${response.status}`);
    return parsePage(await response.text());
  }

  const listings = new Map<string, Listing>();
  const visited = new Set([1]);
  const pending = new Map<number, string>();
  function collect(result: ReturnType<typeof parsePage>) {
    for (const item of result.listings) listings.set(item.id, item);
    for (const [page, url] of result.pages) {
      if (!visited.has(page)) pending.set(page, url);
    }
  }

  collect(await fetchPage(DEGEWO_ENDPOINT, true));
  while (pending.size > 0) {
    const batch = [...pending.entries()].slice(0, 3);
    for (const [page] of batch) {
      pending.delete(page);
      visited.add(page);
    }
    if (visited.size > 100)
      throw new Error("degewo pagination exceeded the page limit");
    const results = await Promise.all(batch.map(([, url]) => fetchPage(url)));
    results.forEach(collect);
  }
  return [...listings.values()];
}
