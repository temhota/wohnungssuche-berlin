import type { ListingResult } from "./types";

export const LISTINGS_TTL_MS = 120_000;

export function createLoadingResult(providers: string[]): ListingResult {
  return {
    listings: [],
    sources: providers.map((provider) => ({
      provider,
      status: "loading",
      count: 0,
    })),
    fetchedAt: new Date().toISOString(),
  };
}

export function providersToRefresh(
  result: ListingResult,
  providers: string[],
  now: number,
) {
  return providers.filter((provider) => {
    const source = result.sources.find((item) => item.provider === provider);
    return (
      !source ||
      !source.fetchedAt ||
      now - Date.parse(source.fetchedAt) >= LISTINGS_TTL_MS
    );
  });
}

export function mergeResults(
  previous: ListingResult,
  incoming: ListingResult,
): ListingResult {
  const sources = new Map(
    previous.sources.map((source) => [source.provider, source]),
  );
  let listings = [...previous.listings];
  for (const source of incoming.sources) {
    const old = sources.get(source.provider);
    if (source.status === "error" && old?.fetchedAt) {
      sources.set(source.provider, {
        ...old,
        stale: true,
        error: source.error,
      });
    } else if (
      source.provisional &&
      old?.fetchedAt &&
      listings.some(
        (item) => item.provider === source.provider && item.verified !== false,
      )
    ) {
      const combined = new Map(
        incoming.listings
          .filter((item) => item.provider === source.provider)
          .map((item) => [item.id, item]),
      );
      for (const item of listings.filter(
        (item) => item.provider === source.provider,
      )) {
        if (item.verified !== false || !combined.has(item.id))
          combined.set(item.id, item);
      }
      listings = listings.filter((item) => item.provider !== source.provider);
      listings.push(...combined.values());
      sources.set(source.provider, {
        ...source,
        count: combined.size,
        fetchedAt: old.fetchedAt,
        stale: true,
      });
    } else {
      sources.set(source.provider, source);
      listings = listings.filter((item) => item.provider !== source.provider);
      listings.push(
        ...incoming.listings.filter(
          (item) => item.provider === source.provider,
        ),
      );
    }
  }
  const timestamps = [...sources.values()]
    .flatMap((source) => (source.fetchedAt ? [source.fetchedAt] : []))
    .sort();
  return {
    listings: listings.sort((a, b) => a.warmRent - b.warmRent),
    sources: [...sources.values()],
    fetchedAt: timestamps[0] ?? incoming.fetchedAt,
  };
}
