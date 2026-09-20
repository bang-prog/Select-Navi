import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOSのホーム画面用アイコン。app-icons.mdの規約に従い、このファイル名だけで
// Next.jsが自動的に <link rel="apple-touch-icon"> を出力してくれる
export default async function Icon() {
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
        <svg width="90" height="90" viewBox="0 0 100 100">
          <polygon points="50,10 90,90 10,90" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
