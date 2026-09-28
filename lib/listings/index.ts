import { fetchDegewoListings } from "./degewo";
import { fetchGesobauListings } from "./gesobau";
import { fetchHowogeListings } from "./howoge";
import type { Listing, ListingResult, ListingSource } from "./types";
import { LISTINGS_TTL_MS } from "./client-data";

export const providerFetchers: Record<string, () => Promise<Listing[]>> = {
  HOWOGE: fetchHowogeListings,
  degewo: fetchDegewoListings,
  GESOBAU: fetchGesobauListings,
};

async function readProvider(provider: string) {
  const listings = await providerFetchers[provider]();
  return { listings, fetchedAt: new Date().toISOString() };
}

export async function getListings(
  selectedProviders?: string[],
  loadProvider: (
    provider: string,
  ) => Promise<{ listings: Listing[]; fetchedAt: string }> = readProvider,
): Promise<ListingResult> {
  const listings: Listing[] = [];
  const sources: ListingSource[] = [];

  const providers = Object.keys(providerFetchers).filter(
    (provider) =>
      selectedProviders === undefined || selectedProviders.includes(provider),
  );

  const results = await Promise.allSettled(
    providers.map((provider) => loadProvider(provider)),
  );

  results.forEach((result, index) => {
    const provider = providers[index];
    if (result.status === "fulfilled") {
      listings.push(...result.value.listings);
      sources.push({
        provider,
        status: "ok",
        count: result.value.listings.length,
        fetchedAt: result.value.fetchedAt,
        stale:
          Date.now() - Date.parse(result.value.fetchedAt) >= LISTINGS_TTL_MS,
      });
    } else {
      sources.push({
        provider,
        status: "error",
        count: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown error",
      });
    }
  });

  return {
    listings: listings.sort((a, b) => a.warmRent - b.warmRent),
    sources,
    fetchedAt:
      sources
        .flatMap((source) => (source.fetchedAt ? [source.fetchedAt] : []))
        .sort()[0] ?? new Date().toISOString(),
  };
}

export type { Listing, ListingResult, ListingSource } from "./types";
