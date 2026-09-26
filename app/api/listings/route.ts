import { NextResponse } from "next/server";
import { getListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getListings();
  const hasSuccessfulSource = result.sources.some(
    (source) => source.status === "ok",
  );

  return NextResponse.json(result, {
    status: hasSuccessfulSource ? 200 : 502,
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
