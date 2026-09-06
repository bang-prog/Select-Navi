import { NextRequest, NextResponse } from "next/server";
import type { LatLng, LegKind, RouteLeg, RouteResult, RouteStep } from "@/lib/types";
import { estimateTolls } from "@/lib/toll";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapboxDirectionsResponse {
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { type: "LineString"; coordinates: LatLng[] };
    legs: Array<{
      steps: Array<{
        maneuver: { instruction: string; location: LatLng };
        distance: number;
        duration: number;
      }>;
    }>;
  }>;
}

async function fetchDirections(a: LatLng, b: LatLng, avoidHighway: boolean) {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${a[0]},${a[1]};${b[0]},${b[1]}`
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN ?? "");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "true");
  url.searchParams.set("language", "ja");
  if (avoidHighway) {
    url.searchParams.set("exclude", "motorway");
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox Directions APIエラー (status ${res.status})`);
  }
  const data: MapboxDirectionsResponse = await res.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new Error("ルートが見つかりませんでした");
  }
  return route;
}

function toLeg(route: MapboxDirectionsResponse["routes"][number], kind: LegKind): RouteLeg {
  const steps: RouteStep[] = (route.legs?.[0]?.steps ?? []).map((s) => ({
    instruction: s.maneuver.instruction,
    distance: s.distance,
    duration: s.duration,
    maneuverLocation: s.maneuver.location,
  }));

  const distanceKm = route.distance / 1000;

  return {
    kind,
    distanceKm,
    durationMin: route.duration / 60,
    geometry: route.geometry,
    steps,
    tollEstimate:
      kind === "highway"
        ? {
            note: "NEXCO標準区間の計算式による概算です。本四高速・首都高速・阪神高速など特殊区間は含まれておらず、実際の料金と異なる場合があります。",
            fares: estimateTolls(distanceKm),
          }
        : undefined,
  };
}

export async function POST(req: NextRequest) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: "MAPBOXトークンが設定されていません" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { origin, destination, entryIC, exitIC } = body as {
      origin?: LatLng;
      destination?: LatLng;
      entryIC?: LatLng;
      exitIC?: LatLng;
    };

    if (!origin || !destination) {
      return NextResponse.json({ error: "出発地と目的地は必須です" }, { status: 400 });
    }

    const legs: RouteLeg[] = [];

    if (entryIC && exitIC) {
      const [r1, r2, r3] = await Promise.all([
        fetchDirections(origin, entryIC, true),
        fetchDirections(entryIC, exitIC, false),
        fetchDirections(exitIC, destination, true),
      ]);
      legs.push(toLeg(r1, "local"), toLeg(r2, "highway"), toLeg(r3, "local"));
    } else {
      const r = await fetchDirections(origin, destination, false);
      legs.push(toLeg(r, "local"));
    }

    const result: RouteResult = {
      legs,
      totalDistanceKm: legs.reduce((sum, l) => sum + l.distanceKm, 0),
      totalDurationMin: legs.reduce((sum, l) => sum + l.durationMin, 0),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ルート計算に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
