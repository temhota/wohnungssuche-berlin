import { unstable_cache } from "next/cache";
import { getListings, providerFetchers } from "./index";
import { LISTINGS_TTL_MS } from "./client-data";

// Cache normalized successful snapshots, including all pages and their true timestamp.
// Next's Data Cache serves stale snapshots while revalidating in the background.
const readProvider = unstable_cache(
  async (provider: string) => {
    const listings = await providerFetchers[provider]();
    return { listings, fetchedAt: new Date().toISOString() };
  },
  ["listing-provider-snapshot-v1"],
  { revalidate: LISTINGS_TTL_MS / 1000 },
);

export function getCachedListings(providers?: string[]) {
  return getListings(providers, readProvider);
}
