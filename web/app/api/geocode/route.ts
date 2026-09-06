import { NextRequest, NextResponse } from "next/server";
import type { GeocodeResult } from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
}

interface GoogleSearchTextResponse {
  places?: GooglePlace[];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ results: [] });
  }
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEYが設定されていません" }, { status: 500 });
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: q,
      languageCode: "ja",
      regionCode: "JP",
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ results: [] }, { status: 502 });
  }

  const data: GoogleSearchTextResponse = await res.json();
  const results: GeocodeResult[] = (data.places ?? []).slice(0, 5).map((p) => ({
    name: p.displayName?.text
      ? p.formattedAddress
        ? `${p.displayName.text} (${p.formattedAddress})`
        : p.displayName.text
      : (p.formattedAddress ?? ""),
    coordinates: [p.location.longitude, p.location.latitude],
  }));

  return NextResponse.json({ results });
}
