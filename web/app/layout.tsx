import type { Metadata, Viewport } from "next";
import { Yusei_Magic, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

// 見出し用：手描き風フォント（ステッカーのロゴっぽさを出す）
const yuseiMagic = Yusei_Magic({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

// 本文用：読みやすい丸ゴシック
const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-body",
  weight: ["500", "700"],
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
  themeColor: "#196ee6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${yuseiMagic.variable} ${zenMaruGothic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
