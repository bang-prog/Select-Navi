const SESSION_ID_KEY = "selectNaviSessionId";

// ログイン機能がないため、端末ごとの匿名IDをlocalStorageに保持し、
// 同じ端末が繰り返し選んでいるルート傾向を追跡できるようにする
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}
