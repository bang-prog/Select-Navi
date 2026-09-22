import type { Metadata, Viewport } from "next";
import { Anta, Jaro, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

// タイトルロゴ用：システム/計器盤風の角ばったフォント
const anta = Anta({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

// アイキャッチ用の小さなラベル（"NAVIGATION SYSTEM"等）
const jaro = Jaro({
  variable: "--font-eyebrow",
  weight: "400",
  subsets: ["latin"],
});

// ラベル・入力欄・ボタンなど、HUD的な質感を出す等幅フォント
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// 本文用の可読フォント
const outfit = Outfit({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Select Navi",
  description: "IC登録で下道ルートも自動生成するナビアプリ",
  appleWebApp: {
    capable: true,
    title: "Select Navi",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FCF9E9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${anta.variable} ${jaro.variable} ${jetBrainsMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
