"use client";

import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
} from "react-leaflet";

import type {
  WorldMonitorEarthquake,
  WorldMonitorNaturalEvent,
  WorldMonitorWeatherAlert,
} from "@/lib/world-monitor";

const INITIAL_CENTER: [number, number] = [20, 10];
const MAP_LIMITS: [[number, number], [number, number]] = [
  [-85, -180],
  [85, 180],
];

type SelectedIncident =
  | {
      id: string;
      kind: "earthquake";
    }
  | {
      id: string;
      kind: "natural";
    }
  | {
      id: string;
      kind: "weather";
    };

type WorldMonitorMapProps = {
  earthquakes: WorldMonitorEarthquake[];
  naturalEvents: WorldMonitorNaturalEvent[];
  onSelect: (incident: SelectedIncident) => void;
  selected: SelectedIncident | null;
  weatherAlerts: WorldMonitorWeatherAlert[];
};

function earthquakeColor(magnitude: number | null) {
  if ((magnitude ?? 0) >= 6) {
    return "#c2410c";
  }

  if ((magnitude ?? 0) >= 4) {
    return "#ea580c";
  }

  return "#f59e0b";
}

function earthquakeRadius(magnitude: number | null) {
  if (!magnitude) {
    return 6;
  }

  return Math.max(6, Math.min(18, Math.round(magnitude * 3)));
}

function naturalColor(categoryId: string) {
  switch (categoryId) {
    case "wildfires":
      return "#dc2626";
    case "severeStorms":
      return "#2563eb";
    case "volcanoes":
      return "#7c3aed";
    case "floods":
      return "#0891b2";
    case "seaLakeIce":
      return "#0f766e";
    case "drought":
      return "#b45309";
    default:
      return "#475569";
  }
}

function weatherColor(severity: WorldMonitorWeatherAlert["severity"]) {
  switch (severity) {
    case "Extreme":
      return "#b91c1c";
    case "Severe":
      return "#dc2626";
    case "Moderate":
      return "#f59e0b";
    case "Minor":
      return "#facc15";
    default:
      return "#64748b";
  }
}

export default function WorldMonitorMap({
  earthquakes,
  naturalEvents,
  onSelect,
  selected,
  weatherAlerts,
}: WorldMonitorMapProps) {
  return (
    <MapContainer
      center={INITIAL_CENTER}
      zoom={2}
      minZoom={2}
      maxZoom={8}
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

      {earthquakes.map((earthquake) => {
        const isSelected =
          selected?.kind === "earthquake" && selected.id === earthquake.id;

        return (
          <CircleMarker
            key={earthquake.id}
            center={[earthquake.latitude, earthquake.longitude]}
            radius={earthquakeRadius(earthquake.magnitude)}
            pathOptions={{
              color: earthquakeColor(earthquake.magnitude),
              fillColor: earthquakeColor(earthquake.magnitude),
              fillOpacity: isSelected ? 0.9 : 0.45,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => onSelect({ id: earthquake.id, kind: "earthquake" }),
            }}
          >
            <Tooltip className="flight-tooltip" direction="top" offset={[0, -12]}>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{earthquake.title}</p>
                <p className="text-xs text-slate-600">{earthquake.place}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {naturalEvents.map((event) => {
        const isSelected = selected?.kind === "natural" && selected.id === event.id;

        return (
          <CircleMarker
            key={event.id}
            center={[event.latitude, event.longitude]}
            radius={isSelected ? 10 : 8}
            pathOptions={{
              color: naturalColor(event.categoryId),
              fillColor: naturalColor(event.categoryId),
              fillOpacity: isSelected ? 0.9 : 0.65,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{
              click: () => onSelect({ id: event.id, kind: "natural" }),
            }}
          >
            <Tooltip className="flight-tooltip" direction="top" offset={[0, -12]}>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">{event.title}</p>
                <p className="text-xs text-slate-600">{event.category}</p>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {weatherAlerts
        .filter((alert) => alert.centroid)
        .map((alert) => {
          const isSelected =
            selected?.kind === "weather" && selected.id === alert.id;

          return (
            <CircleMarker
              key={alert.id}
              center={alert.centroid ?? [0, 0]}
              radius={isSelected ? 9 : 7}
              pathOptions={{
                color: weatherColor(alert.severity),
                fillColor: weatherColor(alert.severity),
                fillOpacity: isSelected ? 0.9 : 0.6,
                weight: isSelected ? 3 : 1.5,
                dashArray: "4 4",
              }}
              eventHandlers={{
                click: () => onSelect({ id: alert.id, kind: "weather" }),
              }}
            >
              <Tooltip
                className="flight-tooltip"
                direction="top"
                offset={[0, -12]}
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{alert.event}</p>
                  <p className="text-xs text-slate-600">{alert.area}</p>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
