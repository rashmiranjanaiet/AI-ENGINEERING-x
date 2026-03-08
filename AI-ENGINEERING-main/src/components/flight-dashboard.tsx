"use client";

import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import FlightMap from "@/components/flight-map-shell";
import type {
  Airport,
  Flight,
  FlightContext,
  MapViewport,
  SessionUser,
} from "@/lib/types";

const DEFAULT_VIEWPORT: MapViewport = {
  south: -85,
  west: -180,
  north: 85,
  east: 180,
  zoom: 2,
};

const AUTO_REFRESH_MS = 30_000;

type FlightsResponse = {
  flights: Flight[];
  fetchedAt: string;
};

type ContextResponse = FlightContext & {
  error?: string;
};

function buildBbox(viewport: MapViewport) {
  return [
    viewport.south.toFixed(4),
    viewport.west.toFixed(4),
    viewport.north.toFixed(4),
    viewport.east.toFixed(4),
  ].join(",");
}

function buildFlightLabel(flight: Flight) {
  if (flight.flight_iata) {
    return flight.flight_iata;
  }

  if (flight.airline_iata && flight.flight_number) {
    return `${flight.airline_iata}${flight.flight_number}`;
  }

  if (flight.flight_number) {
    return flight.flight_number;
  }

  return flight.hex;
}

function formatRoute(flight: Flight) {
  if (flight.dep_iata && flight.arr_iata) {
    return `${flight.dep_iata} -> ${flight.arr_iata}`;
  }

  return "Route unavailable";
}

function formatSpeed(speed?: number) {
  return typeof speed === "number" ? `${Math.round(speed)} km/h` : "Unknown";
}

function formatAltitude(altitude?: number) {
  return typeof altitude === "number" ? `${Math.round(altitude)} m` : "Unknown";
}

function formatUpdated(timestamp?: number) {
  if (!timestamp) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function getAirportByCode(airports: Airport[], code?: string) {
  if (!code) {
    return null;
  }

  return airports.find((airport) => airport.iata_code === code) ?? null;
}

function sameViewport(a: MapViewport, b: MapViewport) {
  return (
    Math.abs(a.south - b.south) < 0.05 &&
    Math.abs(a.west - b.west) < 0.05 &&
    Math.abs(a.north - b.north) < 0.05 &&
    Math.abs(a.east - b.east) < 0.05 &&
    a.zoom === b.zoom
  );
}

export default function FlightDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [flightContext, setFlightContext] = useState<FlightContext | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [flightError, setFlightError] = useState("");
  const [contextError, setContextError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [manualRefreshCount, setManualRefreshCount] = useState(0);
  const [isLoadingFlights, setIsLoadingFlights] = useState(true);
  const [isRefreshingFlights, setIsRefreshingFlights] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const lastFetchKeyRef = useRef("");
  const contextCacheRef = useRef<Record<string, FlightContext>>({});

  const selectedFlight =
    flights.find((flight) => flight.hex === selectedHex) ?? null;

  const filteredFlights = flights.filter((flight) => {
    if (!deferredQuery) {
      return true;
    }

    const haystack = [
      buildFlightLabel(flight),
      flight.airline_iata,
      flight.dep_iata,
      flight.arr_iata,
      flight.aircraft_icao,
      flight.hex,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(deferredQuery);
  });

  const cruisingFlights = flights.filter((flight) => (flight.alt ?? 0) >= 9000).length;
  const speedSamples = flights.filter((flight) => typeof flight.speed === "number");
  const averageSpeed = speedSamples.length
    ? Math.round(
        speedSamples.reduce((total, flight) => total + (flight.speed ?? 0), 0) /
          speedSamples.length,
      )
    : 0;
  const peakAltitude = Math.max(0, ...flights.map((flight) => flight.alt ?? 0));
  const selectedAirports = flightContext?.airports ?? [];
  const departureAirport = getAirportByCode(
    selectedAirports,
    selectedFlight?.dep_iata,
  );
  const arrivalAirport = getAirportByCode(
    selectedAirports,
    selectedFlight?.arr_iata,
  );

  const fetchFlights = useEffectEvent(
    async (nextViewport: MapViewport, reason: "initial" | "refresh" | "viewport") => {
      if (reason === "initial") {
        setIsLoadingFlights(true);
      } else {
        setIsRefreshingFlights(true);
      }

      setFlightError("");

      try {
        const bbox = buildBbox(nextViewport);
        const response = await fetch(
          `/api/flights?bbox=${encodeURIComponent(bbox)}&zoom=${nextViewport.zoom}`,
          {
            cache: "no-store",
          },
        );

        const data = (await response.json()) as FlightsResponse & {
          error?: string;
        };

        if (!response.ok || !Array.isArray(data.flights)) {
          throw new Error(data.error ?? "Unable to load live flights.");
        }

        lastFetchKeyRef.current = `${bbox}:${nextViewport.zoom}`;
        setFlights(data.flights);
        setLastUpdated(data.fetchedAt);

        if (data.flights.length === 0) {
          setSelectedHex(null);
          setFlightContext(null);
          return;
        }

        if (
          selectedHex &&
          data.flights.some((flight) => flight.hex === selectedHex)
        ) {
          setSelectedHex(selectedHex);
        } else {
          setSelectedHex(data.flights[0].hex);
        }
      } catch (error) {
        setFlightError(
          error instanceof Error
            ? error.message
            : "Unable to load live flights right now.",
        );
      } finally {
        setIsLoadingFlights(false);
        setIsRefreshingFlights(false);
      }
    },
  );

  const fetchFlightContext = useEffectEvent(async (flight: Flight | null) => {
    if (!flight) {
      setFlightContext(null);
      setContextError("");
      return;
    }

    const contextKey = [
      flight.dep_iata ?? "",
      flight.arr_iata ?? "",
      flight.airline_iata ?? "",
    ].join(":");

    if (!contextKey.replaceAll(":", "")) {
      setFlightContext(null);
      setContextError("");
      return;
    }

    const cachedContext = contextCacheRef.current[contextKey];

    if (cachedContext) {
      setFlightContext(cachedContext);
      setContextError("");
      return;
    }

    setIsLoadingContext(true);
    setContextError("");

    try {
      const params = new URLSearchParams();

      if (flight.dep_iata) {
        params.set("dep", flight.dep_iata);
      }

      if (flight.arr_iata) {
        params.set("arr", flight.arr_iata);
      }

      if (flight.airline_iata) {
        params.set("airline", flight.airline_iata);
      }

      const response = await fetch(`/api/flight-context?${params.toString()}`, {
        cache: "no-store",
      });

      const data = (await response.json()) as ContextResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load flight details.");
      }

      const nextContext = {
        airports: data.airports ?? [],
        airline: data.airline ?? null,
      } satisfies FlightContext;

      contextCacheRef.current[contextKey] = nextContext;
      setFlightContext(nextContext);
    } catch (error) {
      setContextError(
        error instanceof Error
          ? error.message
          : "Unable to load flight details right now.",
      );
    } finally {
      setIsLoadingContext(false);
    }
  });

  useEffect(() => {
    void fetchFlights(DEFAULT_VIEWPORT, "initial");
  }, []);

  useEffect(() => {
    const currentKey = `${buildBbox(viewport)}:${viewport.zoom}`;

    if (!lastFetchKeyRef.current || currentKey === lastFetchKeyRef.current) {
      return;
    }

    void fetchFlights(viewport, "viewport");
  }, [viewport]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchFlights(viewport, "refresh");
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [viewport]);

  useEffect(() => {
    if (manualRefreshCount === 0) {
      return;
    }

    void fetchFlights(viewport, "refresh");
  }, [manualRefreshCount, viewport]);

  useEffect(() => {
    void fetchFlightContext(selectedFlight);
  }, [selectedFlight]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    startLogoutTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="panel-glow rounded-[30px] border border-white/65 bg-white/72 px-6 py-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.34em] text-slate-500">
                Airscope live radar
              </p>
              <div className="space-y-2">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Watch live aircraft moving across the globe.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Monitor flights in real time, inspect route details, and keep
                  live tabs on altitude, speed, airline, and callsign data.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Logged in
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {user.name}
                </p>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>

              <Link
                href="/nasa"
                className="rounded-[22px] border border-[#163753] bg-[#163753] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0f2435]"
              >
                NASA data
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-[22px] border border-slate-900 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/76 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Live window
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Flights in view
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setManualRefreshCount((count) => count + 1)}
                  className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 transition hover:border-slate-400"
                >
                  {isRefreshingFlights ? "Refreshing" : "Refresh"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/65">
                    Tracked
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {flights.length.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-[24px] bg-white px-4 py-4 text-slate-950">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    Cruising
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{cruisingFlights}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    Avg speed
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {averageSpeed ? `${averageSpeed} km/h` : "n/a"}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                    Peak altitude
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {peakAltitude ? `${peakAltitude.toLocaleString()} m` : "n/a"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Search flights
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Flight, airline, route, aircraft"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {lastUpdated
                      ? `Last refresh: ${new Date(lastUpdated).toLocaleTimeString()}`
                      : "Waiting for first update"}
                  </span>
                  <span>30 second auto refresh</span>
                </div>
              </div>
            </section>

            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/76 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Selected aircraft
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    {selectedFlight ? buildFlightLabel(selectedFlight) : "No flight selected"}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {selectedFlight?.status ?? "standby"}
                </span>
              </div>

              {selectedFlight ? (
                <div className="space-y-4">
                  <div className="rounded-[24px] bg-gradient-to-br from-[#163753] via-[#0f2435] to-[#09141e] p-5 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-white/60">
                          Route
                        </p>
                        <p className="mt-2 text-3xl font-semibold">
                          {formatRoute(selectedFlight)}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/75">
                        {selectedFlight.aircraft_icao ?? "Aircraft n/a"}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] bg-white/10 px-4 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
                          Speed
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {formatSpeed(selectedFlight.speed)}
                        </p>
                      </div>
                      <div className="rounded-[20px] bg-white/10 px-4 py-3">
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
                          Altitude
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {formatAltitude(selectedFlight.alt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Airline
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {flightContext?.airline?.name ??
                          selectedFlight.airline_iata ??
                          "Unknown airline"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Flight number: {selectedFlight.flight_number ?? "n/a"}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Last seen
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {formatUpdated(selectedFlight.updated)}
                      </p>
                      <p className="text-sm text-slate-600">
                        ICAO hex: {selectedFlight.hex}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        Departure and arrival
                      </p>
                      {isLoadingContext ? (
                        <span className="text-xs text-slate-500">Loading route context...</span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-[20px] bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Departure
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {departureAirport?.name ?? selectedFlight.dep_iata ?? "Unknown"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {selectedFlight.dep_iata ?? "No code"}
                        </p>
                      </div>

                      <div className="rounded-[20px] bg-slate-50 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Arrival
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-950">
                          {arrivalAirport?.name ?? selectedFlight.arr_iata ?? "Unknown"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {selectedFlight.arr_iata ?? "No code"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {contextError ? (
                    <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {contextError}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                  Select a plane from the map or list to inspect its route, speed,
                  altitude, airline, and live status.
                </div>
              )}
            </section>

            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/76 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Flight list
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Matching aircraft
                  </h2>
                </div>
                <span className="text-sm text-slate-600">
                  {filteredFlights.length.toLocaleString()} results
                </span>
              </div>

              <div className="flight-scroll max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {filteredFlights.length ? (
                  filteredFlights.map((flight) => (
                    <button
                      type="button"
                      key={flight.hex}
                      onClick={() => setSelectedHex(flight.hex)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedHex === flight.hex
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200/80 bg-white/80 text-slate-900 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold">
                            {buildFlightLabel(flight)}
                          </p>
                          <p
                            className={`text-sm ${
                              selectedHex === flight.hex
                                ? "text-white/70"
                                : "text-slate-600"
                            }`}
                          >
                            {formatRoute(flight)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                            selectedHex === flight.hex
                              ? "bg-white/10 text-white/70"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {flight.airline_iata ?? "n/a"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p
                            className={
                              selectedHex === flight.hex
                                ? "text-white/55"
                                : "text-slate-500"
                            }
                          >
                            Speed
                          </p>
                          <p className="mt-1 font-medium">
                            {formatSpeed(flight.speed)}
                          </p>
                        </div>
                        <div>
                          <p
                            className={
                              selectedHex === flight.hex
                                ? "text-white/55"
                                : "text-slate-500"
                            }
                          >
                            Altitude
                          </p>
                          <p className="mt-1 font-medium">
                            {formatAltitude(flight.alt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                    No aircraft match the current search. Clear the search box or
                    move the map to another region.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <section className="panel-glow overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  World map
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Live aircraft positions
                </h2>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span className="status-dot" />
                  {isRefreshingFlights ? "Updating" : "Live"}
                </span>
                <span>
                  {selectedFlight ? buildFlightLabel(selectedFlight) : "Choose an aircraft"}
                </span>
              </div>
            </div>

            <div className="relative h-[820px]">
              <FlightMap
                flights={filteredFlights}
                selectedHex={selectedHex}
                airports={selectedAirports}
                onSelect={(flight) => setSelectedHex(flight.hex)}
                onViewportChange={(nextViewport) => {
                  setViewport((currentViewport) =>
                    sameViewport(currentViewport, nextViewport)
                      ? currentViewport
                      : nextViewport,
                  );
                }}
              />

              <div className="map-fade pointer-events-none absolute inset-0" />

              {isLoadingFlights ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/8 backdrop-blur-[2px]">
                  <div className="rounded-full border border-white/70 bg-white/92 px-5 py-3 text-sm font-semibold text-slate-700 shadow-lg">
                    Loading live flights...
                  </div>
                </div>
              ) : null}

              {flightError ? (
                <div className="absolute bottom-4 left-4 right-4 rounded-[22px] border border-rose-200 bg-white/95 px-4 py-3 text-sm text-rose-700 shadow-lg">
                  {flightError}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
