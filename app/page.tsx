import { getCachedListings } from "@/lib/listings/cached";
import { parseFilters, type SearchParams } from "@/lib/listings/filters";
import ListingsBrowser from "./listings-browser";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: { searchParams?: Promise<SearchParams> } = {}) {
  const params = (await searchParams) ?? {};
  const result = await getCachedListings(parseFilters(params).providers);
  return <ListingsBrowser initialParams={params} initialResult={result} />;
}
