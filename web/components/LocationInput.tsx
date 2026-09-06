"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

interface Props {
  label: string;
  placeholder?: string;
  onSelect: (result: GeocodeResult) => void;
}

export default function LocationInput({ label, placeholder, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const selectedNameRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query === selectedNameRef.current) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
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
  }, [query]);

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {results.map((r, i) => (
            <li
              key={i}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
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
