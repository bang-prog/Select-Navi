export type LatLng = [number, number];

export interface GeocodeResult {
  name: string;
  coordinates: LatLng;
}

export type LegKind = "local" | "highway" | "route";

export type VehicleClass = "light" | "standard" | "medium" | "large" | "extraLarge";

export interface TollEstimate {
  note: string;
  fares: Record<VehicleClass, number>;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  maneuverLocation: LatLng;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: LatLng[];
}

export interface RouteLeg {
  kind: LegKind;
  distanceKm: number;
  durationMin: number;
  geometry: LineStringGeometry;
  steps: RouteStep[];
  tollEstimate?: TollEstimate;
}

export interface RouteResult {
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMin: number;
}

export type ReportType = "accident" | "jam" | "construction";

export interface Report {
  reportId: string;
  type: ReportType;
  lat: number;
  lng: number;
  reportedAt: number;
  // DynamoDBのTTLに使う属性。UNIXエポック秒（ミリ秒ではない）
  expiresAt: number;
}

// ナビ開始時に選ばれたルート方式。IC指定/高速回避/最速（通常検索）のどれだったか
export type RouteChoiceMode = "ic" | "avoidHighway" | "fastest";

export interface RouteChoicePoint {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteChoice {
  choiceId: string;
  // 端末ごとに割り振る匿名ID。ログイン機能がない代わりに、同じ端末の傾向を追える
  sessionId: string;
  createdAt: number;
  mode: RouteChoiceMode;
  origin: RouteChoicePoint;
  destination: RouteChoicePoint;
  entryIC?: RouteChoicePoint;
  exitIC?: RouteChoicePoint;
  totalDistanceKm: number;
  totalDurationMin: number;
  // ナビを最後まで使い切ったか（＝そのルート選択が実際に「使えた」という強いシグナル）
  completed: boolean;
  completedAt?: number;
}
