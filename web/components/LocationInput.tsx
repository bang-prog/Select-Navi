"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

interface Props {
  label: string;
  placeholder?: string;
  value?: string;
  /** 指定すると、検索語にこの単語が含まれていない場合に自動で付加して検索する（例: IC専用欄で「インターチェンジ」を付加） */
  querySuffix?: string;
  onSelect: (result: GeocodeResult) => void;
}

const IC_KEYWORD_PATTERN = /ic|ｉｃ|インターチェンジ|jct|ｊｃｔ|ジャンクション/i;

function buildSearchQuery(rawQuery: string, suffix?: string): string {
  if (!suffix || IC_KEYWORD_PATTERN.test(rawQuery)) return rawQuery;
  return `${rawQuery} ${suffix}`;
}

export default function LocationInput({ label, placeholder, value, querySuffix, onSelect }: Props) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const selectedNameRef = useRef<string | null>(value ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      selectedNameRef.current = value;
      setQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query === selectedNameRef.current) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const searchQuery = buildSearchQuery(query, querySuffix);
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, querySuffix]);

  const filled = Boolean(query);

  return (
    <div className="relative">
      {label && (
        <label
          className="mb-2 block text-[9px] tracking-[0.2em] text-[#6b6b80] uppercase"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <span
          className="pointer-events-none absolute top-1/2 left-[14px] h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{
            background: filled ? "#FF6004" : "#aaa",
            boxShadow: filled ? "0 0 8px #FF6004" : "none",
          }}
        />
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            selectedNameRef.current = null;
            setQuery(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full rounded-md border bg-[#DCD4D4] py-3 pr-4 pl-8 text-[13px] text-[#333] outline-none transition focus:border-[#FF6004]/60 focus:shadow-[0_0_0_3px_rgba(255,96,4,0.08)]"
          style={{
            fontFamily: "var(--font-mono)",
            borderColor: filled ? "rgba(255,96,4,0.4)" : "rgba(0,0,0,0.1)",
          }}
        />
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-black/10 bg-[#FCF9E9] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {results.map((r, i) => (
            <li
              key={i}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[#FF6004]/[0.06]"
              onMouseDown={() => {
                selectedNameRef.current = r.name;
                setQuery(r.name);
                setOpen(false);
                onSelect(r);
              }}
            >
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
