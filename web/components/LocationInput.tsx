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

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-bold text-[#22333B]">{label}</label>
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
        className="w-full rounded-xl border-2 border-[#22333B] bg-[#F7FBF3] px-3 py-2 text-sm"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border-2 border-[#22333B] bg-white shadow-[3px_3px_0_#22333B]">
          {results.map((r, i) => (
            <li
              key={i}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[#F2F7EA]"
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
