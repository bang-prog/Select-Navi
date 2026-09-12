import { NextResponse } from "next/server";

// 一時的な診断用エンドポイント。環境変数が実行時に読めているかどうかだけを確認する（値そのものは返さない）。
// 原因特定後は削除すること。
export async function GET() {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  return NextResponse.json({
    hasGoogleKey: Boolean(googleKey),
    googleKeyLength: googleKey?.length ?? 0,
    hasMapboxToken: Boolean(mapboxToken),
    mapboxTokenLength: mapboxToken?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  });
}
