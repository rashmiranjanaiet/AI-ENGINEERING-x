"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

import type { Airport, Flight, MapViewport } from "@/lib/types";

const INITIAL_CENTER: [number, number] = [22, 8];
const MAP_LIMITS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

type FlightMapProps = {
  flights: Flight[];
  selectedHex: string | null;
  airports: Airport[];
  onSelect: (flight: Flight) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildFlightLabel(flight: Flight) {
  if (flight.flight_iata) {
    return flight.flight_iata;
  }

  if (flight.airline_iata && flight.flight_number) {
    return `${flight.airline_iata}${flight.flight_number}`;
  }

  return flight.hex;
}

function createPlaneIcon(direction: number, isSelected: boolean) {
  return L.divIcon({
    className: "flight-marker-shell",
    html: `<div class="plane-marker${isSelected ? " is-active" : ""}" style="transform: rotate(${direction}deg)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1 9.5 9.5 3 11.5v2l6.5 2L12 23l2.5-7.5 6.5-2v-2l-6.5-2Z" />
      </svg>
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function ViewportReporter({
  onViewportChange,
}: {
  onViewportChange: (viewport: MapViewport) => void;
}) {
  const map = useMapEvents({
    moveend: reportViewport,
    zoomend: reportViewport,
  });

  function reportViewport() {
    const bounds = map.getBounds();

    onViewportChange({
      south: clamp(bounds.getSouth(), -85, 85),
      west: clamp(bounds.getWest(), -180, 180),
      north: clamp(bounds.getNorth(), -85, 85),
      east: clamp(bounds.getEast(), -180, 180),
      zoom: map.getZoom(),
    });
  }

  useEffect(() => {
    reportViewport();
  });

  return null;
}

export default function FlightMap({
  flights,
  selectedHex,
  airports,
  onSelect,
  onViewportChange,
}: FlightMapProps) {
  const routePoints =
    airports.length === 2
      ? airports.map((airport) => [airport.lat, airport.lng] as [number, number])
      : [];

  return (
    <MapContainer
      center={INITIAL_CENTER}
      zoom={2}
      minZoom={2}
      maxZoom={9}
      scrollWheelZoom
      preferCanvas
      zoomControl={false}
      maxBounds={MAP_LIMITS}
      maxBoundsViscosity={0.45}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ViewportReporter onViewportChange={onViewportChange} />

      {routePoints.length === 2 ? (
        <Polyline
          positions={routePoints}
          pathOptions={{
            color: "#d56a42",
            weight: 3,
            opacity: 0.85,
            dashArray: "10 8",
          }}
        />
      ) : null}

      {flights.map((flight) => (
        <Marker
          key={flight.hex}
          position={[flight.lat, flight.lng]}
          icon={createPlaneIcon(flight.dir ?? 0, selectedHex === flight.hex)}
          eventHandlers={{
            click: () => onSelect(flight),
          }}
        >
          <Tooltip className="flight-tooltip" direction="top" offset={[0, -18]}>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">{buildFlightLabel(flight)}</p>
              <p className="text-xs text-slate-600">
                {flight.dep_iata && flight.arr_iata
                  ? `${flight.dep_iata} -> ${flight.arr_iata}`
                  : "Route unavailable"}
              </p>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
