import { NextResponse } from "next/server";
import { getCachedListings } from "@/lib/listings/cached";
import { PROVIDERS } from "@/lib/listings/filters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const selected = params.has("provider")
    ? params.getAll("provider").filter((value) => PROVIDERS.includes(value))
    : undefined;
  const result = await getCachedListings(selected);
  const hasSuccessfulSource = result.sources.some(
    (source) => source.status === "ok",
  );

  return NextResponse.json(result, {
    status: hasSuccessfulSource ? 200 : 502,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
