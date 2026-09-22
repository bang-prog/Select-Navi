"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LatLng, RouteLeg } from "@/lib/types";
import { distanceToPolylineMeters, trimPolylineFromPoint } from "@/lib/geolocation";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const LEG_COLORS: Record<string, string> = {
  local: "#FF6004",
  highway: "#2a2a33",
  route: "#FF6004",
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

function createMarkerElement(large: boolean): HTMLDivElement {
  // 現在地を車（上から見た形）で表現する。真上（北向き）を正面として作り、
  // rotationAlignment: "map" と組み合わせて進行方向へ回転させる
  // ナビ中は現在地を見失わないよう、通常より一回り大きく表示する
  const width = large ? 34 : 20;
  const height = large ? 54 : 32;
  const el = document.createElement("div");
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.filter = "drop-shadow(0 0 3px rgba(255,255,255,0.95))";
  el.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 60 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="5" width="44" height="90" rx="14" fill="#FF6004" stroke="white" stroke-width="2" />
      <rect x="14" y="14" width="32" height="16" rx="4" fill="#FCF9E9" />
      <rect x="16" y="72" width="28" height="14" rx="4" fill="#FCF9E9" />
      <rect x="1" y="18" width="7" height="16" rx="3" fill="#2a2a33" />
      <rect x="52" y="18" width="7" height="16" rx="3" fill="#2a2a33" />
      <rect x="1" y="64" width="7" height="16" rx="3" fill="#2a2a33" />
      <rect x="52" y="64" width="7" height="16" rx="3" fill="#2a2a33" />
    </svg>
  `;
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
      style: "mapbox://styles/yo3bang/cmu8a0shf000w01r77bjuc78g",
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
        element: createMarkerElement(isNavigating),
        rotationAlignment: "map",
      })
        .setLngLat(currentPosition)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(currentPosition);
    }
    markerRef.current.setRotation(heading ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, heading]);

  // ナビ開始／終了でマーカーの大きさを切り替える。サイズ変更だけだと
  // Mapboxがアンカー位置を再計算せず表示がずれるため、同じ位置・向きで作り直す
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const lngLat = marker.getLngLat();
    const rotation = marker.getRotation();
    marker.remove();
    markerRef.current = new mapboxgl.Marker({
      element: createMarkerElement(isNavigating),
      rotationAlignment: "map",
    })
      .setLngLat(lngLat)
      .setRotation(rotation)
      .addTo(map);
  }, [isNavigating]);

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
