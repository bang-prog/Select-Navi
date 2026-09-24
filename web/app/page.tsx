"use client";

import { useCallback, useEffect, useState } from "react";
import LocationInput from "@/components/LocationInput";
import MapView from "@/components/MapView";
import ReportButtons, { REPORT_LABELS } from "@/components/ReportButtons";
import { useTurnByTurn } from "@/lib/useTurnByTurn";
import { useNearbyReports } from "@/lib/useNearbyReports";
import { describeGeolocationError, haversineMeters } from "@/lib/geolocation";
import { getSessionId } from "@/lib/session";
import type { GeocodeResult, LatLng, RouteChoiceMode, RouteResult } from "@/lib/types";
import { VEHICLE_CLASS_LABELS, type VehicleClass } from "@/lib/toll";

const VEHICLE_CLASS_ORDER: VehicleClass[] = ["light", "standard", "medium", "large", "extraLarge"];

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className="mb-3 text-[9px] tracking-[0.2em] text-[#6b6b80] uppercase"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      ── {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors ${
          checked ? "border-[#FF6004]/40 bg-[#FF6004]/15" : "border-black/10 bg-[#DCD4D4]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
            checked ? "left-[19px] bg-[#FF6004] shadow-[0_0_8px_rgba(255,96,4,0.5)]" : "left-0.5 bg-[#aaa]"
          }`}
        />
      </span>
      <span className={`text-[13px] ${checked ? "text-[#2a2a33]" : "text-[#888]"}`}>{label}</span>
    </label>
  );
}

export default function Home() {
  const [origin, setOrigin] = useState<GeocodeResult | null>(null);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [useIC, setUseIC] = useState(false);
  const [entryIC, setEntryIC] = useState<GeocodeResult | null>(null);
  const [exitIC, setExitIC] = useState<GeocodeResult | null>(null);
  const [avoidHighway, setAvoidHighway] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [originLocateError, setOriginLocateError] = useState<string | null>(null);

  // ナビ中にルートを外れたら、現在地を新しい出発地として再計算する。
  // まだ乗りたいICに着く前（1区間目）ならIC経由の指定を維持し、
  // 高速区間・降りたIC後の区間ならIC指定なしで目的地まで直接ルートを引き直す
  const handleOffRoute = useCallback(
    async (currentPosition: LatLng, currentLegIndex: number) => {
      if (!destination) return;
      const stillBeforeEntry = useIC && entryIC && exitIC && currentLegIndex === 0;
      try {
        const res = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin: currentPosition,
            destination: destination.coordinates,
            entryIC: stillBeforeEntry ? entryIC.coordinates : undefined,
            exitIC: stillBeforeEntry ? exitIC.coordinates : undefined,
            avoidHighway,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setRoute(data as RouteResult);
        }
      } catch {
        // 再ルートに失敗しても案内は継続し、逸脱が続けば再度試行される
      }
    },
    [destination, useIC, entryIC, exitIC, avoidHighway]
  );

  const {
    isNavigating,
    currentPosition,
    heading,
    currentStep,
    geoError,
    isRerouting,
    distanceToNextManeuver,
    muted,
    toggleMute,
    start,
    stop,
  } = useTurnByTurn(route?.legs ?? [], handleOffRoute);

  const [headingUp, setHeadingUp] = useState(true);

  const { newReport, dismissNewReport } = useNearbyReports(currentPosition, isNavigating);

  const [currentChoiceId, setCurrentChoiceId] = useState<string | null>(null);

  // ナビ開始時のみ記録する（検索を試しただけの操作をノイズとして混ぜないため）。
  // 記録に失敗してもナビ自体は継続させる
  const handleStartNav = async () => {
    start();
    if (!origin || !destination || !route) return;
    const mode: RouteChoiceMode = avoidHighway ? "avoidHighway" : useIC ? "ic" : "fastest";
    try {
      const res = await fetch("/api/route-choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          mode,
          origin: { name: origin.name, lat: origin.coordinates[1], lng: origin.coordinates[0] },
          destination: {
            name: destination.name,
            lat: destination.coordinates[1],
            lng: destination.coordinates[0],
          },
          entryIC:
            useIC && entryIC
              ? { name: entryIC.name, lat: entryIC.coordinates[1], lng: entryIC.coordinates[0] }
              : undefined,
          exitIC:
            useIC && exitIC
              ? { name: exitIC.name, lat: exitIC.coordinates[1], lng: exitIC.coordinates[0] }
              : undefined,
          totalDistanceKm: route.totalDistanceKm,
          totalDurationMin: route.totalDurationMin,
        }),
      });
      const data = await res.json();
      if (res.ok) setCurrentChoiceId(data.choiceId);
    } catch {
      // 記録に失敗してもナビ自体は継続する
    }
  };

  // ナビを最後まで使い切った＝そのルート選択が実際に有効だったという記録を残す
  const handleStopNav = () => {
    stop();
    if (currentChoiceId) {
      fetch("/api/route-choices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceId: currentChoiceId }),
      }).catch(() => {});
      setCurrentChoiceId(null);
    }
  };

  // 新着通報のアラートは一定時間で自動的に消す
  useEffect(() => {
    if (!newReport) return;
    const timer = setTimeout(dismissNewReport, 8000);
    return () => clearTimeout(timer);
  }, [newReport, dismissNewReport]);

  const canSearch = Boolean(origin && destination && (!useIC || (entryIC && exitIC)));

  // avoidHighwayはstate更新が非同期のため、チェックボックスから即座に再検索する際に
  // 古い値を参照しないよう、呼び出し側から明示的に上書き値を渡せるようにしている
  const runSearch = async (overrides?: { avoidHighway?: boolean }) => {
    if (!origin || !destination) return;
    const effectiveAvoidHighway = overrides?.avoidHighway ?? avoidHighway;
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
          avoidHighway: useIC ? undefined : effectiveAvoidHighway,
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

  const handleAvoidHighwayChange = (checked: boolean) => {
    setAvoidHighway(checked);
    if (checked) {
      setUseIC(false);
      setEntryIC(null);
      setExitIC(null);
    }
    if (origin && destination) {
      runSearch({ avoidHighway: checked });
    }
  };

  const handleUseICChange = (checked: boolean) => {
    setUseIC(checked);
    if (checked) {
      setAvoidHighway(false);
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

  const statusText = isNavigating ? "NAVIGATING" : loading ? "SEARCHING..." : "SYSTEM READY";

  return (
    <div className="min-h-screen bg-[#FCF9E9] text-[#2a2a33]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <div>
            <p
              className="mb-2 text-[10px] tracking-[0.2em] opacity-80"
              style={{ fontFamily: "var(--font-eyebrow)" }}
            >
              NAVIGATION SYSTEM
            </p>
            <h1
              className="text-2xl leading-none font-bold text-[#FF6004]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              SELECT
              <br />
              NAVI
            </h1>
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full bg-[#FF6004] shadow-[0_0_6px_#FF6004] ${loading || isNavigating ? "animate-pulse" : ""}`}
              />
              <span
                className="text-[10px] tracking-[0.1em] text-[#6b6b80]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {statusText}
              </span>
            </div>
          </div>

          <div className="h-px bg-black/[0.07]" />

          <div className="space-y-5">
            <div>
              <SectionLabel>出発地</SectionLabel>
              <LocationInput
                label=""
                placeholder="例: 徳島駅"
                value={origin?.name}
                onSelect={setOrigin}
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locatingOrigin}
                className="mt-2 text-[10px] tracking-[0.05em] text-[#FF6004] disabled:opacity-40"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {locatingOrigin ? "現在地を取得中..." : "◎ 現在地を出発地にする"}
              </button>
              {originLocateError && (
                <p className="mt-1 text-xs text-[#c0392b]">{originLocateError}</p>
              )}
            </div>

            <div>
              <SectionLabel>目的地</SectionLabel>
              <LocationInput label="" placeholder="例: 亀岡駅" onSelect={setDestination} />
            </div>

            <div className="h-px bg-black/[0.07]" />

            <div>
              <SectionLabel>ルート設定</SectionLabel>
              <div className="space-y-3">
                <Toggle
                  checked={avoidHighway}
                  onChange={handleAvoidHighwayChange}
                  label="高速道路を使わない"
                />
                {!avoidHighway && (
                  <Toggle checked={useIC} onChange={handleUseICChange} label="IC経由で下道ルートも指定する" />
                )}
              </div>

              {!avoidHighway && useIC && (
                <div className="mt-3 ml-1 space-y-3 border-l border-[#FF6004]/25 pl-3">
                  <LocationInput
                    label="乗りたいIC"
                    placeholder="例: 鳴門"
                    querySuffix="インターチェンジ"
                    onSelect={setEntryIC}
                  />
                  <LocationInput
                    label="降りたいIC"
                    placeholder="例: 垂水"
                    querySuffix="インターチェンジ"
                    onSelect={setExitIC}
                  />
                </div>
              )}
            </div>

            <button
              disabled={!canSearch || loading}
              onClick={() => runSearch()}
              className="w-full rounded-md py-3.5 text-xs font-semibold tracking-[0.15em] text-white uppercase transition disabled:cursor-not-allowed disabled:bg-[#DCD4D4] disabled:text-[#aaa] disabled:shadow-none"
              style={{
                fontFamily: "var(--font-mono)",
                background: canSearch ? "linear-gradient(135deg, #FF6004 0%, #ff8c42 100%)" : undefined,
                boxShadow: canSearch ? "0 0 30px rgba(255,96,4,0.25), 0 4px 16px rgba(255,96,4,0.15)" : undefined,
              }}
            >
              {loading ? "SEARCHING..." : "ルートを検索"}
            </button>

            {error && <p className="text-sm font-bold text-[#c0392b]">{error}</p>}
          </div>

          {route && (
            <div className="space-y-3 border-t border-black/[0.07] pt-5">
              <SectionLabel>ルート概要</SectionLabel>
              <ul className="space-y-2 text-sm">
                {route.legs.map((leg, i) => (
                  <li key={i}>
                    <div
                      className="flex justify-between text-xs tracking-[0.05em] text-[#6b6b80] uppercase"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      <span>
                        {leg.kind === "highway"
                          ? "高速区間"
                          : leg.kind === "route"
                            ? "ルート"
                            : "下道区間"}{" "}
                        {i + 1}
                      </span>
                      <span>
                        {leg.distanceKm.toFixed(1)}km / {Math.round(leg.durationMin)}分
                      </span>
                    </div>
                    {leg.tollEstimate && (
                      <div className="mt-1 rounded-md border border-black/10 bg-[#F5F2E3] p-2 text-xs">
                        <ul className="space-y-0.5">
                          {VEHICLE_CLASS_ORDER.map((vc) => (
                            <li key={vc} className="flex justify-between">
                              <span>{VEHICLE_CLASS_LABELS[vc]}</span>
                              <span>{leg.tollEstimate!.fares[vc].toLocaleString()}円</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[#6b6b80]">※{leg.tollEstimate.note}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between rounded-md border border-[#FF6004]/20 bg-[#FF6004]/[0.06] px-4 py-3">
                <div>
                  <div
                    className="mb-1 text-[9px] tracking-[0.1em] text-[#6b6b80] uppercase"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    推定所要時間
                  </div>
                  <div
                    className="text-xl font-bold text-[#FF6004]"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {Math.round(route.totalDurationMin)}分
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="mb-1 text-[9px] tracking-[0.1em] text-[#6b6b80] uppercase"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    距離
                  </div>
                  <div className="text-xl font-bold" style={{ fontFamily: "var(--font-mono)" }}>
                    {route.totalDistanceKm.toFixed(1)}km
                  </div>
                </div>
              </div>

              <p
                className="text-right text-xs tracking-[0.05em] text-[#6b6b80]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                到着予定：
                {new Date(Date.now() + route.totalDurationMin * 60000).toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              {!isNavigating ? (
                <button
                  onClick={handleStartNav}
                  className="w-full rounded-md py-3 text-xs font-semibold tracking-[0.15em] text-white uppercase"
                  style={{
                    fontFamily: "var(--font-mono)",
                    background: "linear-gradient(135deg, #FF6004 0%, #ff8c42 100%)",
                    boxShadow: "0 0 20px rgba(255,96,4,0.2)",
                  }}
                >
                  ナビ開始
                </button>
              ) : (
                <button
                  onClick={handleStopNav}
                  className="w-full rounded-md border border-[#FF6004]/40 bg-transparent py-3 text-xs font-semibold tracking-[0.15em] text-[#FF6004] uppercase"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  ナビ終了
                </button>
              )}

              {isNavigating && (
                <div className="flex gap-2">
                  <button
                    onClick={toggleMute}
                    className="flex-1 rounded-md border border-black/10 bg-[#F5F2E3] py-2 text-xs font-semibold tracking-[0.05em] uppercase"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {muted ? "🔇 音声OFF" : "🔊 音声ON"}
                  </button>
                  <button
                    onClick={() => setHeadingUp((v) => !v)}
                    className="flex-1 rounded-md border border-black/10 bg-[#F5F2E3] py-2 text-xs font-semibold tracking-[0.05em] uppercase"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {headingUp ? "🧭 進行方向上" : "🧭 北上固定"}
                  </button>
                </div>
              )}

              {isNavigating && isRerouting && (
                <div
                  className="rounded-md border border-black/10 bg-[#F5F2E3] p-3 text-xs tracking-[0.02em]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  ルートを外れたため、再検索しています…
                </div>
              )}

              {isNavigating && currentStep && (
                <div className="rounded-md border border-black/10 bg-[#F5F2E3] p-3 text-sm">
                  <p
                    className="mb-1 text-[9px] tracking-[0.15em] text-[#6b6b80] uppercase"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    次の案内
                  </p>
                  <p>{currentStep.instruction}</p>
                </div>
              )}

              {geoError && (
                <p
                  className="rounded-md border border-[#c0392b]/30 bg-[#c0392b]/[0.06] p-3 text-sm font-bold text-[#c0392b]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {geoError}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-black/[0.07] pt-4 text-[9px] tracking-[0.1em] text-[#c9c1c1]" style={{ fontFamily: "var(--font-mono)" }}>
            <span>POWERED BY MAPBOX</span>
            <span>v2.0</span>
          </div>
        </div>

        <div className="relative h-[70vh] overflow-hidden rounded-md border border-black/10 lg:h-auto">
          <MapView
            legs={route?.legs ?? []}
            currentPosition={currentPosition}
            isNavigating={isNavigating}
            heading={heading}
            headingUp={headingUp}
          />

          {isNavigating && currentStep && (
            <div className="absolute top-4 right-4 left-4 max-w-xs rounded-md border border-black/10 bg-[#FCF9E9]/95 p-3 shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:left-auto">
              <p
                className="mb-1 text-[9px] tracking-[0.15em] text-[#FF6004] uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {distanceToNextManeuver == null
                  ? "案内"
                  : distanceToNextManeuver < 30
                    ? "まもなく"
                    : `${(Math.round(distanceToNextManeuver / 10) * 10).toLocaleString()}m先`}
              </p>
              <p className="text-base leading-snug font-bold">{currentStep.instruction}</p>
            </div>
          )}

          {newReport && currentPosition && (
            <div className="absolute top-24 right-4 left-4 max-w-xs rounded-md border border-[#FF6004]/30 bg-[#FCF9E9]/95 p-3 text-sm font-bold shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:left-auto">
              約{Math.round(haversineMeters(currentPosition, [newReport.lng, newReport.lat]) / 100) * 100}
              m先で{REPORT_LABELS[newReport.type]}の通報がありました
            </div>
          )}

          {isNavigating && (
            <div className="absolute bottom-4 right-4">
              <ReportButtons currentPosition={currentPosition} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
