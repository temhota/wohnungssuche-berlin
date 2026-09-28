import type { Listing } from "./types";

export const PROVIDERS = ["HOWOGE", "degewo", "GESOBAU"];
export type SearchParams = Record<string, string | string[] | undefined>;

function values(value: string | string[] | undefined): string[] {
  return [
    ...new Set(
      value === undefined ? [] : Array.isArray(value) ? value : [value],
    ),
  ];
}

function amount(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || !/^\d+(?:[.,]\d+)?$/.test(value.trim()))
    return undefined;
  const result = Number(value.trim().replace(",", "."));
  return Number.isFinite(result) ? result : undefined;
}

export function parseFilters(params: SearchParams) {
  return {
    providers:
      params.sources === "selected" || params.provider !== undefined
        ? values(params.provider).filter((provider) =>
            PROVIDERS.includes(provider),
          )
        : [...PROVIDERS],
    districts: values(params.district).filter(Boolean),
    minRent: amount(params.minRent),
    maxRent: amount(params.maxRent),
    minArea: amount(params.minArea),
    maxArea: amount(params.maxArea),
    excludeWbs: params.excludeWbs === "1",
  };
}

export type Filters = ReturnType<typeof parseFilters>;

export function filterListings(listings: Listing[], filters: Filters) {
  return listings.filter(
    (item) =>
      filters.providers.includes(item.provider) &&
      (filters.districts.length === 0 ||
        (item.district !== null &&
          filters.districts.includes(item.district))) &&
      (filters.minRent === undefined || item.warmRent >= filters.minRent) &&
      (filters.maxRent === undefined || item.warmRent <= filters.maxRent) &&
      (filters.minArea === undefined || item.area >= filters.minArea) &&
      (filters.maxArea === undefined || item.area <= filters.maxArea) &&
      (!filters.excludeWbs || !item.wbs),
  );
}

export function pageHref(params: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of [
    "sources",
    "provider",
    "district",
    "minRent",
    "maxRent",
    "minArea",
    "maxArea",
    "excludeWbs",
  ]) {
    for (const value of values(params[key]))
      if (value) query.append(key, value);
  }
  query.set("page", String(page));
  return `?${query}`;
}
