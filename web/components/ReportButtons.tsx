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
  accident: "border-[#c0392b]/40 text-[#c0392b]",
  jam: "border-[#27824A]/40 text-[#27824A]",
  construction: "border-[#B8860B]/40 text-[#B8860B]",
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
        <div
          className="rounded-md border border-black/10 bg-[#FCF9E9]/95 px-3 py-1.5 text-xs font-bold text-[#2a2a33] shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        >
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
            className={`rounded-md border bg-[#FCF9E9]/95 px-3 py-2 text-[11px] font-semibold tracking-[0.05em] uppercase backdrop-blur-sm disabled:opacity-50 ${REPORT_COLORS[type]}`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {submittingType === type ? "送信中…" : REPORT_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
