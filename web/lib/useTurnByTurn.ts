"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng, RouteLeg, RouteStep } from "./types";
import {
  computeBearing,
  describeGeolocationError,
  distanceToPolylineMeters,
  haversineMeters,
} from "./geolocation";

const ARRIVAL_THRESHOLD_M = 40;
// GPSの誤差でこれ未満の移動しかない場合は進行方向の再計算をしない（停止中のブレ防止）
const MIN_DISTANCE_FOR_HEADING_M = 3;
// ルートから外れたと判定する距離
const OFF_ROUTE_THRESHOLD_M = 50;
// 誤差による瞬間的なブレで誤反応しないよう、この時間以上連続で外れていたら再ルートする
const OFF_ROUTE_CONFIRM_MS = 8000;

function speak(text: string, muted: boolean) {
  if (muted) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  window.speechSynthesis.speak(utter);
}

export function useTurnByTurn(
  legs: RouteLeg[],
  onOffRoute?: (currentPosition: LatLng, currentLegIndex: number) => void
) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      // ミュートにした瞬間、再生中の音声も即座に止める
      if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);
  const watchIdRef = useRef<number | null>(null);
  const prevPositionRef = useRef<LatLng | null>(null);
  const offRouteSinceRef = useRef<number | null>(null);
  const reroutingRef = useRef(false);
  const isNavigatingRef = useRef(false);

  const steps: RouteStep[] = legs.flatMap((l) => l.steps);
  const legIndexOfStep: number[] = legs.flatMap((l, li) => l.steps.map(() => li));

  // 再ルート等でlegsそのものが差し替わった時に参照する最新値（watchPositionのコールバックは
  // start()呼び出し時点のクロージャを使い続けるため、refで最新値を追えるようにする）
  const legsRef = useRef(legs);
  const stepsRef = useRef(steps);
  const legIndexOfStepRef = useRef(legIndexOfStep);
  const onOffRouteRef = useRef(onOffRoute);
  useEffect(() => {
    legsRef.current = legs;
    stepsRef.current = steps;
    legIndexOfStepRef.current = legIndexOfStep;
    onOffRouteRef.current = onOffRoute;
  });

  // ナビ中にlegsが更新された（＝再ルート結果が反映された）タイミングで案内を最初からやり直す
  useEffect(() => {
    if (!isNavigatingRef.current) return;
    setStepIndex(0);
    offRouteSinceRef.current = null;
    reroutingRef.current = false;
    setIsRerouting(false);
    setDistanceToNextManeuver(null);
    if (steps[0]) speak(steps[0].instruction, mutedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs]);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      alert("この端末では位置情報が利用できません");
      return;
    }
    setGeoError(null);
    setStepIndex(0);
    setHeading(null);
    setIsRerouting(false);
    setDistanceToNextManeuver(null);
    prevPositionRef.current = null;
    offRouteSinceRef.current = null;
    reroutingRef.current = false;
    isNavigatingRef.current = true;
    setIsNavigating(true);
    if (stepsRef.current[0]) speak(stepsRef.current[0].instruction, mutedRef.current);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const current: LatLng = [pos.coords.longitude, pos.coords.latitude];
        setCurrentPosition(current);

        const rawHeading = pos.coords.heading;
        if (rawHeading !== null && !Number.isNaN(rawHeading)) {
          setHeading(rawHeading);
        } else if (prevPositionRef.current) {
          const movedDistance = haversineMeters(prevPositionRef.current, current);
          if (movedDistance > MIN_DISTANCE_FOR_HEADING_M) {
            setHeading(computeBearing(prevPositionRef.current, current));
          }
        }
        prevPositionRef.current = current;

        let activeLegIndex = 0;
        let maneuverDistance: number | null = null;
        setStepIndex((idx) => {
          const currentSteps = stepsRef.current;
          activeLegIndex = legIndexOfStepRef.current[idx] ?? Math.max(legsRef.current.length - 1, 0);
          const step = currentSteps[idx];
          if (!step?.maneuverLocation) return idx;
          const dist = haversineMeters(current, step.maneuverLocation);
          if (dist < ARRIVAL_THRESHOLD_M && idx < currentSteps.length - 1) {
            const next = idx + 1;
            activeLegIndex = legIndexOfStepRef.current[next] ?? activeLegIndex;
            const nextStep = currentSteps[next];
            maneuverDistance = nextStep?.maneuverLocation
              ? haversineMeters(current, nextStep.maneuverLocation)
              : null;
            speak(nextStep.instruction, mutedRef.current);
            return next;
          }
          maneuverDistance = dist;
          return idx;
        });
        setDistanceToNextManeuver(maneuverDistance);

        // ルート逸脱検知→一定時間続いたら再ルートを要求する
        const callback = onOffRouteRef.current;
        if (callback && !reroutingRef.current) {
          const activeLeg = legsRef.current[activeLegIndex];
          const distToRoute = activeLeg
            ? distanceToPolylineMeters(current, activeLeg.geometry.coordinates)
            : Infinity;

          if (distToRoute > OFF_ROUTE_THRESHOLD_M) {
            if (offRouteSinceRef.current === null) {
              offRouteSinceRef.current = Date.now();
            } else if (Date.now() - offRouteSinceRef.current > OFF_ROUTE_CONFIRM_MS) {
              reroutingRef.current = true;
              offRouteSinceRef.current = null;
              setIsRerouting(true);
              callback(current, activeLegIndex);
            }
          } else {
            offRouteSinceRef.current = null;
          }
        }
      },
      (err) => {
        const message = describeGeolocationError(err);
        console.error(`位置情報の取得に失敗しました (code=${err.code}): ${err.message}`);
        setGeoError(message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    isNavigatingRef.current = false;
    setIsNavigating(false);
    setIsRerouting(false);
    setDistanceToNextManeuver(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return {
    isNavigating,
    currentPosition,
    heading,
    currentStep: steps[stepIndex] ?? null,
    geoError,
    isRerouting,
    distanceToNextManeuver,
    muted,
    toggleMute,
    start,
    stop,
  };
}
