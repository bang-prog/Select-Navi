"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng, RouteLeg } from "@/lib/types";
import { distanceToPolylineMeters, trimPolylineFromPoint } from "@/lib/geolocation";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const LEG_COLORS: Record<string, string> = {
  local: "#196ee6",
  highway: "#e63946",
};

interface Props {
  legs: RouteLeg[];
  currentPosition: LatLng | null;
  isNavigating: boolean;
  heading: number | null;
}

const MAX_LEG_LAYERS = 5;
const NAVIGATION_ZOOM = 17;
const NAVIGATION_PITCH = 60;

function createMarkerElement(): HTMLDivElement {
  // 進行方向を指す矢印（三角形）。rotationAlignment: "map" と組み合わせて向きを表現する
  const el = document.createElement("div");
  el.style.width = "0";
  el.style.height = "0";
  el.style.borderLeft = "9px solid transparent";
  el.style.borderRight = "9px solid transparent";
  el.style.borderBottom = "18px solid #196ee6";
  el.style.filter = "drop-shadow(0 0 2px rgba(255,255,255,0.9))";
  return el;
}

export default function MapView({ legs, currentPosition, isNavigating, heading }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const wasNavigatingRef = useRef(false);

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
      // ナビ中の再ルートでは、追従カメラが現在地に合わせるのでズームアウトさせない
      const shouldFitBounds = !isNavigating;

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

      if (shouldFitBounds && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.once("load", applyLayers);
    }
  }, [legs, isNavigating]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentPosition) return;

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({
        element: createMarkerElement(),
        rotationAlignment: "map",
      })
        .setLngLat(currentPosition)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(currentPosition);
    }
    markerRef.current.setRotation(heading ?? 0);
  }, [currentPosition, heading]);

  // ナビ中は現在地に応じて、通過済みの区間を地図上から消す
  // （通過済みの区間＝現在地から一番近い区間より手前の区間は非表示にし、
  // 現在地が属する区間は、現在地の直近点から先だけを描画し直す）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isNavigating || !currentPosition || legs.length === 0) return;
    if (!map.isStyleLoaded()) return;

    let activeIndex = 0;
    let minDist = Infinity;
    legs.forEach((leg, i) => {
      const d = distanceToPolylineMeters(currentPosition, leg.geometry.coordinates);
      if (d < minDist) {
        minDist = d;
        activeIndex = i;
      }
    });

    legs.forEach((leg, i) => {
      const id = `route-leg-${i}`;
      if (!map.getLayer(id)) return;

      if (i < activeIndex) {
        map.setLayoutProperty(id, "visibility", "none");
        return;
      }

      map.setLayoutProperty(id, "visibility", "visible");
      if (i === activeIndex) {
        const trimmed = trimPolylineFromPoint(currentPosition, leg.geometry.coordinates);
        const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
        source?.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: trimmed },
        });
      }
    });
  }, [currentPosition, isNavigating, legs]);

  // ナビ中は現在地・進行方向に合わせてカメラを追従させる（車の少し上からの視点）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isNavigating && currentPosition) {
      map.easeTo({
        center: currentPosition,
        zoom: NAVIGATION_ZOOM,
        pitch: NAVIGATION_PITCH,
        bearing: heading ?? map.getBearing(),
        duration: wasNavigatingRef.current ? 800 : 1000,
      });
      wasNavigatingRef.current = true;
    } else if (wasNavigatingRef.current && !isNavigating) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      wasNavigatingRef.current = false;
    }
  }, [currentPosition, isNavigating, heading]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden rounded-2xl" />;
}
