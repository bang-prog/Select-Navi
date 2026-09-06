"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng, RouteLeg } from "@/lib/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const LEG_COLORS: Record<string, string> = {
  local: "#196ee6",
  highway: "#e63946",
};

interface Props {
  legs: RouteLeg[];
  currentPosition: LatLng | null;
}

const MAX_LEG_LAYERS = 5;

export default function MapView({ legs, currentPosition }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [135.5, 34.7],
      zoom: 7,
    });
    mapRef.current = map;

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyLayers = () => {
      for (let i = 0; i < MAX_LEG_LAYERS; i++) {
        const id = `route-leg-${i}`;
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }

      if (legs.length === 0) return;

      const bounds = new mapboxgl.LngLatBounds();

      legs.forEach((leg, i) => {
        const id = `route-leg-${i}`;
        map.addSource(id, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: leg.geometry },
        });
        map.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": LEG_COLORS[leg.kind] ?? "#196ee6",
            "line-width": 5,
          },
        });
        leg.geometry.coordinates.forEach((c) => bounds.extend(c));
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.once("load", applyLayers);
    }
  }, [legs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;

    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = "#196ee6";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 4px rgba(0,0,0,0.4)";
      markerRef.current = new mapboxgl.Marker(el).setLngLat(currentPosition).addTo(map);
    } else {
      markerRef.current.setLngLat(currentPosition);
    }
  }, [currentPosition]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl" />;
}
