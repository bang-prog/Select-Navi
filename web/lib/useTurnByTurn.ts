"use client";

import { useCallback, useRef, useState } from "react";
import type { LatLng, RouteLeg, RouteStep } from "./types";
import { computeBearing, describeGeolocationError, haversineMeters } from "./geolocation";

const ARRIVAL_THRESHOLD_M = 40;
// GPSの誤差でこれ未満の移動しかない場合は進行方向の再計算をしない（停止中のブレ防止）
const MIN_DISTANCE_FOR_HEADING_M = 3;

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  window.speechSynthesis.speak(utter);
}

export function useTurnByTurn(legs: RouteLeg[]) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const prevPositionRef = useRef<LatLng | null>(null);

  const steps: RouteStep[] = legs.flatMap((l) => l.steps);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      alert("この端末では位置情報が利用できません");
      return;
    }
    setGeoError(null);
    setStepIndex(0);
    setHeading(null);
    prevPositionRef.current = null;
    setIsNavigating(true);
    if (steps[0]) speak(steps[0].instruction);

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

        setStepIndex((idx) => {
          const step = steps[idx];
          if (!step?.maneuverLocation) return idx;
          const dist = haversineMeters(current, step.maneuverLocation);
          if (dist < ARRIVAL_THRESHOLD_M && idx < steps.length - 1) {
            const next = idx + 1;
            speak(steps[next].instruction);
            return next;
          }
          return idx;
        });
      },
      (err) => {
        const message = describeGeolocationError(err);
        console.error(`位置情報の取得に失敗しました (code=${err.code}): ${err.message}`);
        setGeoError(message);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsNavigating(false);
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
    start,
    stop,
  };
}
