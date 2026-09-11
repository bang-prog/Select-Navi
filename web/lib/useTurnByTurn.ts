"use client";

import { useCallback, useRef, useState } from "react";
import type { LatLng, RouteLeg, RouteStep } from "./types";
import { describeGeolocationError } from "./geolocation";

const ARRIVAL_THRESHOLD_M = 40;

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  const [stepIndex, setStepIndex] = useState(0);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const steps: RouteStep[] = legs.flatMap((l) => l.steps);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      alert("この端末では位置情報が利用できません");
      return;
    }
    setGeoError(null);
    setStepIndex(0);
    setIsNavigating(true);
    if (steps[0]) speak(steps[0].instruction);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const current: LatLng = [pos.coords.longitude, pos.coords.latitude];
        setCurrentPosition(current);

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
    currentStep: steps[stepIndex] ?? null,
    geoError,
    start,
    stop,
  };
}
