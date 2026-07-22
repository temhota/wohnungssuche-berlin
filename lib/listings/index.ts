import { fetchDegewoListings } from "./degewo";
import { fetchGesobauListings } from "./gesobau";
import { fetchHowogeListings } from "./howoge";
import type { Listing, ListingResult, ListingSource } from "./types";

export async function getListings(): Promise<ListingResult> {
  const listings: Listing[] = [];
  const sources: ListingSource[] = [];

  const providers = [
    { provider: "HOWOGE", fetch: fetchHowogeListings },
    { provider: "degewo", fetch: fetchDegewoListings },
    { provider: "GESOBAU", fetch: fetchGesobauListings },
  ];

  const results = await Promise.allSettled(providers.map((provider) => provider.fetch()));

  results.forEach((result, index) => {
    const provider = providers[index].provider;
    if (result.status === "fulfilled") {
      listings.push(...result.value);
      sources.push({ provider, status: "ok", count: result.value.length });
    } else {
      sources.push({
        provider,
        status: "error",
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  });

  return {
    listings: listings.sort((a, b) => a.warmRent - b.warmRent),
    sources,
    fetchedAt: new Date().toISOString(),
  };
}

export type { Listing, ListingResult, ListingSource } from "./types";
