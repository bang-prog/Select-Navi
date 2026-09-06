export type VehicleClass = "light" | "standard" | "medium" | "large" | "extraLarge";

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  light: "軽自動車等",
  standard: "普通車",
  medium: "中型車",
  large: "大型車",
  extraLarge: "特大車",
};

const VEHICLE_CLASS_RATIOS: Record<VehicleClass, number> = {
  light: 0.8,
  standard: 1.0,
  medium: 1.2,
  large: 1.65,
  extraLarge: 2.75,
};

const TERMINAL_CHARGE_YEN = 150;
const RATE_PER_KM_YEN = 24.6;
const CONSUMPTION_TAX = 1.1;

function roundToNearest10(value: number): number {
  return Math.round(value / 10) * 10;
}

export function estimateTolls(distanceKm: number): Record<VehicleClass, number> {
  const result = {} as Record<VehicleClass, number>;
  for (const vehicleClass of Object.keys(VEHICLE_CLASS_RATIOS) as VehicleClass[]) {
    const preTax = (distanceKm * RATE_PER_KM_YEN + TERMINAL_CHARGE_YEN) * VEHICLE_CLASS_RATIOS[vehicleClass];
    result[vehicleClass] = roundToNearest10(preTax * CONSUMPTION_TAX);
  }
  return result;
}
