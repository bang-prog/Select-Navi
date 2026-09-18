"use client";

import { useState } from "react";
import type { LatLng, ReportType } from "@/lib/types";

export const REPORT_LABELS: Record<ReportType, string> = {
  accident: "事故",
  jam: "渋滞",
  construction: "工事",
};

const REPORT_ORDER: ReportType[] = ["accident", "jam", "construction"];

const REPORT_COLORS: Record<ReportType, string> = {
  accident: "bg-red-600 text-white",
  jam: "bg-green-600 text-white",
  construction: "bg-yellow-400 text-slate-900",
};

interface Props {
  currentPosition: LatLng | null;
}

export default function ReportButtons({ currentPosition }: Props) {
  const [submittingType, setSubmittingType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleReport = async (type: ReportType) => {
    if (!currentPosition) {
      setMessage("現在地が取得できていません");
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setSubmittingType(type);
    setMessage(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, position: currentPosition }),
      });
      if (!res.ok) throw new Error("failed");
      setMessage(`${REPORT_LABELS[type]}を通報しました`);
    } catch {
      setMessage("通報に失敗しました");
    } finally {
      setSubmittingType(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {message && (
        <div className="rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow">
          {message}
        </div>
      )}
      <div className="flex gap-2">
        {REPORT_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleReport(type)}
            disabled={submittingType !== null}
            className={`rounded-full px-3 py-2 text-xs font-semibold shadow-lg disabled:opacity-50 ${REPORT_COLORS[type]}`}
          >
            {submittingType === type ? "送信中…" : REPORT_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
