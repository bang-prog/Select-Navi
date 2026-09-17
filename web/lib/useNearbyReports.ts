"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng, Report } from "./types";

const POLL_INTERVAL_MS = 30000;

export function useNearbyReports(currentPosition: LatLng | null, active: boolean) {
  const [reports, setReports] = useState<Report[]>([]);
  const [newReport, setNewReport] = useState<Report | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const positionRef = useRef<LatLng | null>(currentPosition);

  useEffect(() => {
    positionRef.current = currentPosition;
  }, [currentPosition]);

  // activeの間だけ一定間隔でポーリングする。現在地はpositionRef経由で
  // 常に最新のものを参照するため、GPS更新のたびに間隔がリセットされることはない
  useEffect(() => {
    if (!active) {
      seenIdsRef.current = new Set();
      setReports([]);
      setNewReport(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const pos = positionRef.current;
      if (!pos) return;
      try {
        const [lng, lat] = pos;
        const res = await fetch(`/api/reports?lat=${lat}&lng=${lng}`);
        if (!res.ok) return;
        const data = await res.json();
        const fetched: Report[] = data.reports ?? [];
        if (cancelled) return;

        setReports(fetched);
        const unseen = fetched.find((r) => !seenIdsRef.current.has(r.reportId));
        fetched.forEach((r) => seenIdsRef.current.add(r.reportId));
        if (unseen) setNewReport(unseen);
      } catch {
        // ポーリング失敗は無視し、次回の間隔で再試行する
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return {
    reports,
    newReport,
    dismissNewReport: () => setNewReport(null),
  };
}
