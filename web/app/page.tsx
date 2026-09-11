"use client";

import { useState } from "react";
import LocationInput from "@/components/LocationInput";
import MapView from "@/components/MapView";
import { useTurnByTurn } from "@/lib/useTurnByTurn";
import { describeGeolocationError } from "@/lib/geolocation";
import type { GeocodeResult, RouteResult } from "@/lib/types";
import { VEHICLE_CLASS_LABELS, type VehicleClass } from "@/lib/toll";

const VEHICLE_CLASS_ORDER: VehicleClass[] = ["light", "standard", "medium", "large", "extraLarge"];

export default function Home() {
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [useIC, setUseIC] = useState(false);
  const [entryIC, setEntryIC] = useState<GeocodeResult | null>(null);
  const [exitIC, setExitIC] = useState<GeocodeResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [originLocateError, setOriginLocateError] = useState<string | null>(null);

  const { isNavigating, currentPosition, heading, currentStep, geoError, start, stop } = useTurnByTurn(
    route?.legs ?? []
  );

  const canSearch = Boolean(origin && destination && (!useIC || (entryIC && exitIC)));

  const handleSearch = async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin.coordinates,
          destination: destination.coordinates,
          entryIC: useIC ? entryIC?.coordinates : undefined,
          exitIC: useIC ? exitIC?.coordinates : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "ルート検索に失敗しました");
      }
      setRoute(data as RouteResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setOriginLocateError("この端末では位置情報が利用できません");
      return;
    }
    setLocatingOrigin(true);
    setOriginLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          name: "現在地",
          coordinates: [pos.coords.longitude, pos.coords.latitude],
        });
        setLocatingOrigin(false);
      },
      (err) => {
        setOriginLocateError(describeGeolocationError(err));
        setLocatingOrigin(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] text-slate-900 dark:bg-[#111821] dark:text-slate-100">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <h1 className="text-xl font-bold">Select Navi</h1>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <LocationInput
                label="出発地"
                placeholder="例: 徳島駅"
                value={origin?.name}
                onSelect={setOrigin}
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locatingOrigin}
                className="mt-1 text-xs font-medium text-[#196ee6] disabled:opacity-40"
              >
                {locatingOrigin ? "現在地を取得中..." : "📍現在地を出発地にする"}
              </button>
              {originLocateError && (
                <p className="mt-1 text-xs text-red-600">{originLocateError}</p>
              )}
            </div>
            <LocationInput label="目的地" placeholder="例: 亀岡駅" onSelect={setDestination} />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useIC} onChange={(e) => setUseIC(e.target.checked)} />
              IC経由で下道ルートも指定する
            </label>

            {useIC && (
              <div className="ml-1 space-y-3 border-l-2 border-slate-200 pl-3 dark:border-slate-800">
                <LocationInput label="乗りたいIC" placeholder="例: 鳴門IC" onSelect={setEntryIC} />
                <LocationInput label="降りたいIC" placeholder="例: 垂水IC" onSelect={setExitIC} />
              </div>
            )}

            <button
              disabled={!canSearch || loading}
              onClick={handleSearch}
              className="w-full rounded-xl bg-[#196ee6] py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {loading ? "検索中..." : "ルートを検索"}
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {route && (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold">ルート概要</h2>
              <ul className="space-y-2 text-sm">
                {route.legs.map((leg, i) => (
                  <li key={i}>
                    <div className="flex justify-between">
                      <span>
                        {leg.kind === "highway" ? "高速区間" : "下道区間"} {i + 1}
                      </span>
                      <span>
                        {leg.distanceKm.toFixed(1)}km / {Math.round(leg.durationMin)}分
                      </span>
                    </div>
                    {leg.tollEstimate && (
                      <div className="mt-1 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
                        <ul className="space-y-0.5">
                          {VEHICLE_CLASS_ORDER.map((vc) => (
                            <li key={vc} className="flex justify-between">
                              <span>{VEHICLE_CLASS_LABELS[vc]}</span>
                              <span>{leg.tollEstimate!.fares[vc].toLocaleString()}円</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          ※{leg.tollEstimate.note}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold dark:border-slate-800">
                <span>合計</span>
                <span>
                  {route.totalDistanceKm.toFixed(1)}km / {Math.round(route.totalDurationMin)}分
                </span>
              </div>

              {!isNavigating ? (
                <button
                  onClick={start}
                  className="mt-2 w-full rounded-xl bg-[#196ee6] py-2 text-sm font-medium text-white"
                >
                  ナビ開始
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="mt-2 w-full rounded-xl bg-red-600 py-2 text-sm font-medium text-white"
                >
                  ナビ終了
                </button>
              )}

              {isNavigating && currentStep && (
                <div className="mt-2 rounded-xl bg-[#196ee6]/10 p-3 text-sm">
                  <p className="font-medium">次の案内</p>
                  <p>{currentStep.instruction}</p>
                </div>
              )}

              {geoError && (
                <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {geoError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="h-[70vh] lg:h-auto">
          <MapView
            legs={route?.legs ?? []}
            currentPosition={currentPosition}
            isNavigating={isNavigating}
            heading={heading}
          />
        </div>
      </div>
    </div>
  );
}
