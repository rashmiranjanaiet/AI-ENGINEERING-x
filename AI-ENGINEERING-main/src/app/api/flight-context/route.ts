import { NextRequest, NextResponse } from "next/server";

import { getAirline, getAirports } from "@/lib/airlabs";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const dep = request.nextUrl.searchParams.get("dep") ?? "";
    const arr = request.nextUrl.searchParams.get("arr") ?? "";
    const airline = request.nextUrl.searchParams.get("airline") ?? "";

    const [airports, airlineRecord] = await Promise.all([
      getAirports([dep, arr]),
      airline ? getAirline(airline) : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        airports,
        airline: airlineRecord,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load flight details right now." },
      { status: 500 },
    );
  }
}
