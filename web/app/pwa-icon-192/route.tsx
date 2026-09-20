import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

// PWAのホーム画面アイコン（192px）。現在地マーカーと同じ「白い矢印」モチーフを使う
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
        <svg width="96" height="96" viewBox="0 0 100 100">
          <polygon points="50,10 90,90 10,90" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
