import { filterListings, type Filters } from "../listings/filters";
import type { ListingResult } from "../listings/types";

export const SEEN_STORAGE_KEY = "kiezfinder.watch.seen.v1";
export function createWatchState(seen: Iterable<string> = []) {
  return { seen: new Set(seen), initialized: new Set<string>() };
}
export type WatchState = ReturnType<typeof createWatchState>;

export function restartWatch(
  previous: WatchState,
  result: ListingResult,
  providers: string[],
  saved: Iterable<string>,
) {
  const state = createWatchState([...previous.seen, ...saved]);
  baselineWatch(state, result, providers);
  return state;
}

export function syncWatchProviders(state: WatchState, providers: string[]) {
  for (const provider of state.initialized) {
    if (!providers.includes(provider)) state.initialized.delete(provider);
  }
}

export function baselineWatch(
  state: WatchState,
  result: ListingResult,
  providers = result.sources.map((source) => source.provider),
) {
  syncWatchProviders(state, providers);
  for (const source of result.sources) {
    if (source.status !== "ok" || !providers.includes(source.provider))
      continue;
    state.initialized.add(source.provider);
    for (const item of result.listings) {
      if (item.provider === source.provider) state.seen.add(item.id);
    }
  }
}

export function observeListings(
  state: WatchState,
  result: ListingResult,
  filters: Filters,
) {
  syncWatchProviders(state, filters.providers);
  const candidates = [];
  for (const source of result.sources) {
    if (
      source.status !== "ok" ||
      source.stale ||
      source.error ||
      !filters.providers.includes(source.provider)
    )
      continue;
    const initialized = state.initialized.has(source.provider);
    for (const item of result.listings) {
      if (item.provider !== source.provider) continue;
      if (initialized && !state.seen.has(item.id)) candidates.push(item);
      state.seen.add(item.id);
    }
    state.initialized.add(source.provider);
  }
  return filterListings(candidates, filters);
}

export function readSeen(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(SEEN_STORAGE_KEY);
    if (raw === null) return { seen: new Set<string>(), available: true };
    const ids: unknown = JSON.parse(raw);
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string"))
      throw new Error("Invalid history");
    return { seen: new Set<string>(ids), available: true };
  } catch {
    return { seen: new Set<string>(), available: false };
  }
}

export function writeSeen(
  storage: Pick<Storage, "setItem">,
  seen: Set<string>,
) {
  try {
    storage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen]));
    return true;
  } catch {
    return false;
  }
}
