import { NextRequest, NextResponse } from "next/server";
import type { LatLng, LegKind, RouteLeg, RouteResult, RouteStep } from "@/lib/types";
import { estimateTolls } from "@/lib/toll";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapboxStep {
  maneuver: { instruction: string; location: LatLng };
  distance: number;
  duration: number;
  geometry: { type: "LineString"; coordinates: LatLng[] };
  intersections?: Array<{ classes?: string[] }>;
}

interface MapboxDirectionsResponse {
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { type: "LineString"; coordinates: LatLng[] };
    legs: Array<{
      steps: MapboxStep[];
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

function isMotorwayStep(step: MapboxStep): boolean {
  return (step.intersections ?? []).some((i) => i.classes?.includes("motorway"));
}

// entryIC→exitIC間のステップの中から、高速道路（motorway）が途切れずに続いている
// 最長区間を探す。鳴門ICのように、IC座標そのものを経由地に強制すると、その地点に
// 立ち寄るために一度高速を降りて側道を通ってから乗り直す、という不自然な迂回ルートに
// なる問題があった。この迂回は実際の高速区間に比べてごく短いため、
// 「一番長く続いている高速区間」だけを本当の高速区間として抜き出し、
// 前後の短い迂回部分は前後のlocal区間に合流させることで、座標を強制したまま
// 不自然な迂回を取り除く
function longestMotorwayRun(steps: MapboxStep[]): { start: number; end: number } {
  let bestStart = 0;
  let bestDistance = 0;
  let curStart = -1;
  let curDistance = 0;

  for (let i = 0; i <= steps.length; i++) {
    const isMotorway = i < steps.length && isMotorwayStep(steps[i]);
    if (isMotorway) {
      if (curStart === -1) {
        curStart = i;
        curDistance = 0;
      }
      curDistance += steps[i].distance;
    } else if (curStart !== -1) {
      if (curDistance > bestDistance) {
        bestStart = curStart;
        bestDistance = curDistance;
      }
      curStart = -1;
    }
  }

  return bestDistance > 0 ? { start: bestStart, end: bestStart + countRun(steps, bestStart) } : { start: 0, end: steps.length };
}

function countRun(steps: MapboxStep[], start: number): number {
  let i = start;
  while (i < steps.length && isMotorwayStep(steps[i])) i++;
  return i - start;
}

function legFromSteps(steps: MapboxStep[], kind: LegKind): RouteLeg {
  const distanceKm = steps.reduce((sum, s) => sum + s.distance, 0) / 1000;
  const durationMin = steps.reduce((sum, s) => sum + s.duration, 0) / 60;
  const routeSteps: RouteStep[] = steps.map((s) => ({
    instruction: s.maneuver.instruction,
    distance: s.distance,
    duration: s.duration,
    maneuverLocation: s.maneuver.location,
  }));

  return {
    kind,
    distanceKm,
    durationMin,
    geometry: { type: "LineString", coordinates: steps.flatMap((s) => s.geometry.coordinates) },
    steps: routeSteps,
    tollEstimate:
      kind === "highway"
        ? {
            note: "NEXCO標準区間の計算式による概算です。本四高速・首都高速・阪神高速など特殊区間は含まれておらず、実際の料金と異なる場合があります。",
            fares: estimateTolls(distanceKm),
          }
        : undefined,
  };
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
    const { origin, destination, entryIC, exitIC, avoidHighway } = body as {
      origin?: LatLng;
      destination?: LatLng;
      entryIC?: LatLng;
      exitIC?: LatLng;
      avoidHighway?: boolean;
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

      const middleSteps = r2.legs?.[0]?.steps ?? [];
      const { start, end } = longestMotorwayRun(middleSteps);
      const entrySteps = [...(r1.legs?.[0]?.steps ?? []), ...middleSteps.slice(0, start)];
      const highwaySteps = middleSteps.slice(start, end);
      const exitSteps = [...middleSteps.slice(end), ...(r3.legs?.[0]?.steps ?? [])];

      legs.push(
        legFromSteps(entrySteps, "local"),
        legFromSteps(highwaySteps, "highway"),
        legFromSteps(exitSteps, "local")
      );
    } else {
      const r = await fetchDirections(origin, destination, Boolean(avoidHighway));
      // 高速道路を避けた場合は確実に下道のみだが、通常の最短ルートは
      // 高速を含み得るため「下道」と決め打ちせず、区別できる種別にしておく
      legs.push(toLeg(r, avoidHighway ? "local" : "route"));
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
