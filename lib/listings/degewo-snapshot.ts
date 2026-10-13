import type { Listing } from "./types";

export type ProviderSnapshot = {
  listings: Listing[];
  fetchedAt: string;
  provisional?: boolean;
  error?: string;
  directFetchedAt?: string;
};
type Reader = () => Promise<ProviderSnapshot>;

export async function loadDegewoSnapshot(
  fast: Reader,
  direct: Reader,
  quick = false,
): Promise<ProviderSnapshot> {
  if (quick) return { ...(await fast()), provisional: true };
  const [feed, verified] = await Promise.allSettled([fast(), direct()]);
  if (verified.status === "rejected") {
    if (feed.status === "rejected") throw verified.reason;
    return {
      ...feed.value,
      provisional: true,
      error:
        verified.reason instanceof Error
          ? verified.reason.message
          : "Direct degewo search failed",
    };
  }
  if (feed.status === "rejected") return verified.value;
  const listings = new Map(feed.value.listings.map((item) => [item.id, item]));
  for (const item of verified.value.listings) listings.set(item.id, item);
  return {
    listings: [...listings.values()],
    fetchedAt: [feed.value.fetchedAt, verified.value.fetchedAt].sort()[0],
    directFetchedAt: verified.value.fetchedAt,
  };
}
