export type LatLng = [number, number];

export interface GeocodeResult {
  name: string;
  coordinates: LatLng;
}

export type LegKind = "local" | "highway";

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
