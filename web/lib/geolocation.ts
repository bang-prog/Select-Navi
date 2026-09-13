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

interface NearestPointOnPolyline {
  distance: number;
  segmentIndex: number;
  t: number;
}

// 現在地から見た、ルート線（LineString座標列）上の最も近い点を求める
// 短距離（数km以内）を想定した簡易的な平面近似（正距円筒図法）で十分な精度
function nearestPointOnPolyline(point: LatLng, coordinates: LatLng[]): NearestPointOnPolyline {
  const R = 6371000;
  const lat0 = (point[1] * Math.PI) / 180;
  const toXY = (p: LatLng) => ({
    x: (((p[0] - point[0]) * Math.PI) / 180) * R * Math.cos(lat0),
    y: (((p[1] - point[1]) * Math.PI) / 180) * R,
  });

  let best: NearestPointOnPolyline = { distance: Infinity, segmentIndex: 0, t: 0 };
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = toXY(coordinates[i]);
    const b = toXY(coordinates[i + 1]);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? (-a.x * abx - a.y * aby) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dist = Math.sqrt(cx * cx + cy * cy);
    if (dist < best.distance) {
      best = { distance: dist, segmentIndex: i, t };
    }
  }
  return best;
}

// 現在地から、あるルート線（LineString座標列）までの最短距離をメートルで返す
export function distanceToPolylineMeters(point: LatLng, coordinates: LatLng[]): number {
  if (coordinates.length === 0) return Infinity;
  if (coordinates.length === 1) return haversineMeters(point, coordinates[0]);
  return nearestPointOnPolyline(point, coordinates).distance;
}

// ルート線のうち、現在地より手前（通過済み）の部分を切り落とし、
// 現在地の直近点から先だけの座標列を返す（ナビ画面で通過済み区間を消すために使う）
export function trimPolylineFromPoint(point: LatLng, coordinates: LatLng[]): LatLng[] {
  if (coordinates.length < 2) return coordinates;
  const { segmentIndex, t } = nearestPointOnPolyline(point, coordinates);
  const a = coordinates[segmentIndex];
  const b = coordinates[segmentIndex + 1];
  const projected: LatLng = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return [projected, ...coordinates.slice(segmentIndex + 1)];
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
