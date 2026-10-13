import { unstable_cache } from "next/cache";
import { getListings, providerFetchers } from "./index";
import { LISTINGS_TTL_MS } from "./client-data";
import { fetchWohnungsfinderDegewoListings } from "./wohnungsfinder";
import { loadDegewoSnapshot, type ProviderSnapshot } from "./degewo-snapshot";

// Cache normalized successful snapshots, including all pages and their true timestamp.
// Next's Data Cache serves stale snapshots while revalidating in the background.
const readProvider = unstable_cache(
  async (provider: string) => {
    const listings = await providerFetchers[provider]();
    return { listings, fetchedAt: new Date().toISOString() };
  },
  ["listing-provider-snapshot-v2"],
  { revalidate: LISTINGS_TTL_MS / 1000 },
);

const readWohnungsfinder = unstable_cache(
  async () => ({
    listings: await fetchWohnungsfinderDegewoListings(),
    fetchedAt: new Date().toISOString(),
  }),
  ["wohnungsfinder-degewo-snapshot-v1"],
  { revalidate: LISTINGS_TTL_MS / 1000 },
);

// The quick response and direct verification share one in-flight feed request.
let pendingFeed: Promise<ProviderSnapshot> | undefined;
function readFeed() {
  if (!pendingFeed)
    pendingFeed = readWohnungsfinder().finally(() => {
      pendingFeed = undefined;
    });
  return pendingFeed;
}

export function getCachedListings(providers?: string[], quickDegewo = false) {
  return getListings(providers, (provider) =>
    provider === "degewo"
      ? loadDegewoSnapshot(readFeed, () => readProvider(provider), quickDegewo)
      : readProvider(provider),
  );
}
