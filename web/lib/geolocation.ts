import type { LatLng } from "./types";

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 2点間の進行方向（真北を0度とした時計回りの角度）を計算する
export function computeBearing(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function describeGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "位置情報の利用が許可されていません。ブラウザのアドレスバー付近の設定から位置情報を「許可」にしてください。";
    case err.POSITION_UNAVAILABLE:
      return "現在地を取得できませんでした。OS側の位置情報サービスがオフになっていないか確認してください（Windowsの場合：設定＞プライバシーとセキュリティ＞位置情報）。";
    case err.TIMEOUT:
      return "位置情報の取得がタイムアウトしました。電波状況の良い場所で再度お試しください。";
    default:
      return `位置情報の取得に失敗しました（コード: ${err.code}）`;
  }
}
