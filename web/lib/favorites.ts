import type { GeocodeResult } from "./types";

const FAVORITES_KEY = "selectNaviFavorites";

export function getFavorites(): GeocodeResult[] {
  if (typeof window === "undefined") return [];  
  try {
    // rawは生のデータという意味の変数
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    // parseで文字列を配列に戻す
    return JSON.parse(raw) as GeocodeResult[]; 
  } catch {
    return [];
  }
}

export function addFavorite(place: GeocodeResult): void {
  if (typeof window === "undefined") return;
  try {
    const current = getFavorites();
    const next = [...current, place];
    // stringifyで文字列に変換
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    // 保存に失敗してもアプリは止めない
  } 
}