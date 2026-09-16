import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, REPORTS_TABLE_NAME } from "@/lib/dynamodb";
import { haversineMeters } from "@/lib/geolocation";
import type { LatLng, Report, ReportType } from "@/lib/types";

// 通報は2時間で自動的に無効化する（DynamoDBのTTLで実際に削除されるまでには
// 多少のタイムラグがあるため、取得時にもexpiresAtで二重にフィルタする）
const REPORT_LIFETIME_SECONDS = 60 * 60 * 2;
// 「近く」とみなす半径
const NEARBY_RADIUS_METERS = 5000;
const VALID_TYPES: ReportType[] = ["accident", "jam", "construction"];

export async function POST(req: NextRequest) {
  if (!REPORTS_TABLE_NAME) {
    return NextResponse.json({ error: "REPORTS_TABLE_NAMEが設定されていません" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { type, position } = body as { type?: ReportType; position?: LatLng };

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "typeが不正です" }, { status: 400 });
    }
    if (!position) {
      return NextResponse.json({ error: "positionは必須です" }, { status: 400 });
    }

    const now = Date.now();
    const report: Report = {
      reportId: randomUUID(),
      type,
      lat: position[1],
      lng: position[0],
      reportedAt: now,
      expiresAt: Math.floor(now / 1000) + REPORT_LIFETIME_SECONDS,
    };

    await ddbDocClient.send(new PutCommand({ TableName: REPORTS_TABLE_NAME, Item: report }));

    return NextResponse.json({ ok: true, reportId: report.reportId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "通報の保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!REPORTS_TABLE_NAME) {
    return NextResponse.json({ error: "REPORTS_TABLE_NAMEが設定されていません" }, { status: 500 });
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "latとlngは必須です" }, { status: 400 });
  }

  try {
    // MVP規模の件数を想定し、全件スキャンしてから距離で絞り込む簡易実装
    const result = await ddbDocClient.send(new ScanCommand({ TableName: REPORTS_TABLE_NAME }));
    const current: LatLng = [lng, lat];
    const nowSeconds = Date.now() / 1000;

    const nearby = (result.Items ?? [])
      .map((item) => item as Report)
      .filter((r) => r.expiresAt > nowSeconds)
      .filter((r) => haversineMeters(current, [r.lng, r.lat]) <= NEARBY_RADIUS_METERS);

    return NextResponse.json({ reports: nearby });
  } catch (err) {
    const message = err instanceof Error ? err.message : "通報の取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
