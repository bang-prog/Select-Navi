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

function isSamePlace(a: GeocodeResult, b: GeocodeResult): boolean {
  return (
    a.name === b.name &&
    a.coordinates[0] === b.coordinates[0] &&
    a.coordinates[1] === b.coordinates[1]
  );
}

export function isFavorite(place: GeocodeResult): boolean {
  return getFavorites().some((f) => isSamePlace(f, place));
}

export function addFavorite(place: GeocodeResult): void {
  if (typeof window === "undefined") return;
  try {
    // すでに同じ場所が登録されていれば何もしない（重複防止）
    if (isFavorite(place)) return;
    const next = [...getFavorites(), place];
    // stringifyで文字列に変換
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    // 保存に失敗してもアプリは止めない
  }
}