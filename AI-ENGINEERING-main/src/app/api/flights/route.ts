import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_BBOX, getFlights } from "@/lib/airlabs";

export const runtime = "nodejs";

function isValidBbox(value: string) {
  const parts = value.split(",").map((part) => Number(part));

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => Number.isFinite(part));
}

function normalizeZoom(value: string | null) {
  const zoom = Number(value ?? 2);

  if (!Number.isFinite(zoom)) {
    return 2;
  }

  return Math.min(10, Math.max(2, Math.round(zoom)));
}

export async function GET(request: NextRequest) {
  try {
    const bbox = request.nextUrl.searchParams.get("bbox") ?? DEFAULT_BBOX;
    const zoom = normalizeZoom(request.nextUrl.searchParams.get("zoom"));

    if (!isValidBbox(bbox)) {
      return NextResponse.json(
        { error: "bbox must contain four numeric coordinates." },
        { status: 400 },
      );
    }

    const flights = await getFlights(bbox, zoom);

    return NextResponse.json(
      {
        flights,
        bbox,
        zoom,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load live flights right now." },
      { status: 500 },
    );
  }
}
