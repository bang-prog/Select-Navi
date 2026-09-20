import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// PWAのホーム画面アイコン（512px）。現在地マーカーと同じ「白い矢印」モチーフを使う
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#196ee6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="256" height="256" viewBox="0 0 100 100">
          <polygon points="50,10 90,90 10,90" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
