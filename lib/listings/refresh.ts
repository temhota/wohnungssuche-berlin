import type { ListingResult } from "./types";

export async function refreshListings(
  providers: string[],
  signal: AbortSignal,
  onResult: (result: ListingResult) => void,
) {
  async function request(
    provider: string,
    quick = false,
  ): Promise<ListingResult> {
    try {
      const query = new URLSearchParams({ provider });
      if (quick) query.set("degewo", "quick");
      const response = await fetch(`/api/listings?${query}`, {
        signal,
        cache: "no-store",
      });
      if (!response.ok && response.status !== 502)
        throw new Error("Aktualisierung fehlgeschlagen");
      return await response.json();
    } catch {
      return {
        listings: [],
        sources: [
          {
            provider,
            status: "error",
            count: 0,
            error: "Aktualisierung fehlgeschlagen",
          },
        ],
        fetchedAt: new Date().toISOString(),
      };
    }
  }
  await Promise.all(
    providers.map(async (provider) => {
      if (signal.aborted) return;
      let completed: ListingResult | undefined;
      const full = request(provider).then((incoming) => {
        completed = incoming;
        if (!signal.aborted) onResult(incoming);
      });
      const quick =
        provider === "degewo"
          ? request(provider, true).then((incoming) => {
              if (
                !completed?.sources.some((source) => source.status === "ok") &&
                !signal.aborted &&
                incoming.sources.some((source) => source.status === "ok")
              )
                onResult(
                  completed
                    ? {
                        ...incoming,
                        sources: incoming.sources.map((source) => ({
                          ...source,
                          error:
                            completed?.sources.find(
                              (item) => item.provider === provider,
                            )?.error ?? "Direkter Abgleich fehlgeschlagen",
                        })),
                      }
                    : incoming,
                );
            })
          : undefined;
      await Promise.all([full, quick]);
    }),
  );
}
