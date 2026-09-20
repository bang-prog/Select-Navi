import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Select Navi",
    short_name: "Select Navi",
    description: "IC登録で下道ルートも自動生成するナビアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f8",
    theme_color: "#196ee6",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
