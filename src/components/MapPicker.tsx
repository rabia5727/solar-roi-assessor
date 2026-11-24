"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], Math.max(map.getZoom(), 10));
  }, [lat, lon, map]);
  return null;
}

export default function MapPicker({
  lat,
  lon,
  onPick,
}: {
  lat: number;
  lon: number;
  onPick: (lat: number, lon: number) => void;
}) {
  return (
    <MapContainer center={[lat, lon]} zoom={10} scrollWheelZoom={false} className="h-56 w-full rounded-lg z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[lat, lon]} radius={9} pathOptions={{ color: "#b45309", fillColor: "#f59e0b", fillOpacity: 0.9 }} />
      <ClickHandler onPick={onPick} />
      <Recenter lat={lat} lon={lon} />
    </MapContainer>
  );
}
