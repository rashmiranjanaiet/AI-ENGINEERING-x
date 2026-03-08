"use client";

import Link from "next/link";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import WorldMonitorMap from "@/components/world-monitor-map-shell";
import type {
  WorldClockCity,
  WorldMonitorDashboardData,
  WorldMonitorEarthquake,
  WorldMonitorNaturalEvent,
  WorldMonitorWeatherAlert,
} from "@/lib/world-monitor";
import type { SessionUser } from "@/lib/types";

type SelectedIncident =
  | { id: string; kind: "earthquake" }
  | { id: string; kind: "natural" }
  | { id: string; kind: "weather" };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function getClockSnapshot(city: WorldClockCity, now: Date) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: city.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour ?? "0");
  const weekday = parts.weekday ?? "";
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const isMarketOpen =
    typeof city.marketOpen === "number" &&
    typeof city.marketClose === "number" &&
    isWeekday &&
    hour >= city.marketOpen &&
    hour < city.marketClose;

  return {
    isMarketOpen,
    time: `${parts.hour ?? "00"}:${parts.minute ?? "00"}:${parts.second ?? "00"}`,
    weekday,
  };
}

function severityClass(severity: WorldMonitorWeatherAlert["severity"]) {
  switch (severity) {
    case "Extreme":
      return "bg-rose-100 text-rose-700";
    case "Severe":
      return "bg-orange-100 text-orange-700";
    case "Moderate":
      return "bg-amber-100 text-amber-700";
    case "Minor":
      return "bg-lime-100 text-lime-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function naturalClass(categoryId: string) {
  switch (categoryId) {
    case "wildfires":
      return "bg-rose-100 text-rose-700";
    case "severeStorms":
      return "bg-sky-100 text-sky-700";
    case "volcanoes":
      return "bg-violet-100 text-violet-700";
    case "floods":
      return "bg-cyan-100 text-cyan-700";
    case "seaLakeIce":
      return "bg-teal-100 text-teal-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function IncidentButton({
  active,
  badge,
  meta,
  onClick,
  title,
}: {
  active: boolean;
  badge: ReactNode;
  meta: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200/80 bg-white/85 text-slate-900 hover:border-slate-400"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className={`mt-1 text-sm ${active ? "text-white/70" : "text-slate-600"}`}>
            {meta}
          </p>
        </div>
        {badge}
      </div>
    </button>
  );
}

export default function WorldMonitorDashboard({
  data,
  user,
}: {
  data: WorldMonitorDashboardData;
  user: SessionUser;
}) {
  const router = useRouter();
  const [isLoggingOut, startLogoutTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<SelectedIncident | null>(() => {
    if (data.strongestEarthquake) {
      return { id: data.strongestEarthquake.id, kind: "earthquake" };
    }
    if (data.naturalEvents[0]) {
      return { id: data.naturalEvents[0].id, kind: "natural" };
    }
    if (data.weatherAlerts[0]) {
      return { id: data.weatherAlerts[0].id, kind: "weather" };
    }
    return null;
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedIncident = useMemo(() => {
    if (!selected) {
      return null;
    }

    if (selected.kind === "earthquake") {
      return data.earthquakes.find((item) => item.id === selected.id) ?? null;
    }
    if (selected.kind === "natural") {
      return data.naturalEvents.find((item) => item.id === selected.id) ?? null;
    }

    return data.weatherAlerts.find((item) => item.id === selected.id) ?? null;
  }, [data.earthquakes, data.naturalEvents, data.weatherAlerts, selected]);

  const naturalMix = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of data.naturalEvents) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [data.naturalEvents]);

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
                World Monitor
              </p>
              <div className="space-y-2">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Global incident monitoring adapted from `worldmonitor-main`.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Track earthquakes, NASA natural events, NOAA weather alerts,
                  and the live market clock from one dashboard.
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
                href="/"
                className="rounded-[22px] border border-[#163753] bg-[#163753] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0f2435]"
              >
                Flight radar
              </Link>

              <Link
                href="/nasa"
                className="rounded-[22px] border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-900 transition hover:border-slate-500"
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

        {data.errors.length ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/95 px-5 py-4 text-sm text-amber-900 shadow-[0_16px_50px_rgba(120,53,15,0.08)]">
            {data.errors.join(" ")}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[28px] bg-slate-950 px-5 py-5 text-white shadow-[0_20px_60px_rgba(15,34,56,0.18)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-white/60">
              Earthquakes
            </p>
            <p className="mt-3 text-3xl font-semibold">{data.earthquakes.length}</p>
            <p className="mt-2 text-sm text-white/70">USGS last 24 hours</p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_20px_60px_rgba(15,34,56,0.1)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Natural events
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {data.naturalEvents.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">NASA EONET open events</p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_20px_60px_rgba(15,34,56,0.1)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Weather alerts
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {data.weatherAlerts.length}
            </p>
            <p className="mt-2 text-sm text-slate-600">NOAA active alerts</p>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-5 shadow-[0_20px_60px_rgba(15,34,56,0.1)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
              Strongest quake
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">
              {data.strongestEarthquake?.magnitude?.toFixed(1) ?? "n/a"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {data.strongestEarthquake?.place ?? "No event available"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="mb-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Market clock
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Global trading day
                </h2>
              </div>

              <div className="space-y-3">
                {data.worldClocks.map((city) => {
                  const snapshot = getClockSnapshot(city, now);

                  return (
                    <div
                      key={city.id}
                      className="flex items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3"
                    >
                      <div>
                        <p className="text-base font-semibold text-slate-950">
                          {city.city}
                        </p>
                        <p className="text-sm text-slate-600">
                          {city.label} · {snapshot.weekday}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-base font-semibold text-slate-950">
                          {snapshot.time}
                        </p>
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                            snapshot.isMarketOpen
                              ? "text-emerald-700"
                              : "text-slate-500"
                          }`}
                        >
                          {typeof city.marketOpen === "number"
                            ? snapshot.isMarketOpen
                              ? "Open"
                              : "Closed"
                            : "Clock"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="mb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Selected incident
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  {selectedIncident ? "Live detail" : "No incident selected"}
                </h2>
              </div>

              {selectedIncident ? (
                <div className="space-y-4">
                  {"magnitude" in selectedIncident ? (
                    <>
                      <div className="rounded-[24px] bg-gradient-to-br from-[#163753] via-[#0f2435] to-[#09141e] p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
                          Earthquake
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {selectedIncident.title}
                        </p>
                        <p className="mt-3 text-sm text-white/70">
                          {selectedIncident.place}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Magnitude
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {selectedIncident.magnitude?.toFixed(1) ?? "n/a"}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Significance
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {selectedIncident.significance}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm leading-7 text-slate-600">
                        Detected {formatDateTime(selectedIncident.time)}.
                        {selectedIncident.tsunami ? " Tsunami flag raised." : " No tsunami flag."}
                      </p>
                    </>
                  ) : "category" in selectedIncident ? (
                    <>
                      <div className="rounded-[24px] bg-gradient-to-br from-[#163753] via-[#0f2435] to-[#09141e] p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
                          Natural event
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {selectedIncident.title}
                        </p>
                        <p className="mt-3 text-sm text-white/70">
                          {selectedIncident.category}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Source
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {selectedIncident.sourceName}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Magnitude
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {selectedIncident.magnitudeLabel ?? "n/a"}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm leading-7 text-slate-600">
                        Last update {formatDateTime(selectedIncident.date)}.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="rounded-[24px] bg-gradient-to-br from-[#163753] via-[#0f2435] to-[#09141e] p-5 text-white">
                        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
                          Weather alert
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {selectedIncident.event}
                        </p>
                        <p className="mt-3 text-sm text-white/70">
                          {selectedIncident.area}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Severity
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {selectedIncident.severity}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Expires
                          </p>
                          <p className="mt-2 text-lg font-semibold text-slate-950">
                            {formatDateTime(selectedIncident.expires)}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm leading-7 text-slate-600">
                        {selectedIncident.headline}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                  Choose an incident from the lists or the map.
                </div>
              )}
            </section>

            <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Natural event mix
              </p>
              <div className="mt-4 grid gap-3">
                {naturalMix.length ? (
                  naturalMix.map(([label, count]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-950">{label}</p>
                      <p className="text-sm text-slate-600">{count} events</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-600">
                    No natural event categories available right now.
                  </div>
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            <section className="panel-glow overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    Global map
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    Earthquakes, natural events, and alerts
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-orange-100 px-3 py-1 font-semibold text-orange-700">
                    Earthquakes
                  </span>
                  <span className="rounded-full bg-sky-100 px-3 py-1 font-semibold text-sky-700">
                    Natural events
                  </span>
                  <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-700">
                    Weather alerts
                  </span>
                </div>
              </div>

              <div className="relative h-[700px]">
                <WorldMonitorMap
                  earthquakes={data.earthquakes}
                  naturalEvents={data.naturalEvents}
                  weatherAlerts={data.weatherAlerts}
                  selected={selected}
                  onSelect={setSelected}
                />
                <div className="map-fade pointer-events-none absolute inset-0" />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      Seismology
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Top earthquakes
                    </h2>
                  </div>
                  <span className="text-sm text-slate-600">
                    {formatCount(data.earthquakes.length)}
                  </span>
                </div>

                <div className="flight-scroll max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {data.earthquakes.length ? (
                    data.earthquakes.slice(0, 8).map((item) => (
                      <IncidentButton
                        key={item.id}
                        active={selected?.kind === "earthquake" && selected.id === item.id}
                        title={item.title}
                        meta={`${item.place} · ${formatDateTime(item.time)}`}
                        onClick={() => setSelected({ id: item.id, kind: "earthquake" })}
                        badge={
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              selected?.kind === "earthquake" && selected.id === item.id
                                ? "bg-white/10 text-white/75"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            M {item.magnitude?.toFixed(1) ?? "n/a"}
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                      No earthquake data available right now.
                    </div>
                  )}
                </div>
              </section>

              <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      NASA EONET
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Natural events
                    </h2>
                  </div>
                  <span className="text-sm text-slate-600">
                    {formatCount(data.naturalEvents.length)}
                  </span>
                </div>

                <div className="flight-scroll max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {data.naturalEvents.length ? (
                    data.naturalEvents.slice(0, 8).map((item) => (
                      <IncidentButton
                        key={item.id}
                        active={selected?.kind === "natural" && selected.id === item.id}
                        title={item.title}
                        meta={`${item.category} · ${formatDateTime(item.date)}`}
                        onClick={() => setSelected({ id: item.id, kind: "natural" })}
                        badge={
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              selected?.kind === "natural" && selected.id === item.id
                                ? "bg-white/10 text-white/75"
                                : naturalClass(item.categoryId)
                            }`}
                          >
                            {item.sourceName}
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                      No natural events available right now.
                    </div>
                  )}
                </div>
              </section>

              <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                      NOAA
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      Weather alerts
                    </h2>
                  </div>
                  <span className="text-sm text-slate-600">
                    {formatCount(data.weatherAlerts.length)}
                  </span>
                </div>

                <div className="flight-scroll max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {data.weatherAlerts.length ? (
                    data.weatherAlerts.slice(0, 8).map((item) => (
                      <IncidentButton
                        key={item.id}
                        active={selected?.kind === "weather" && selected.id === item.id}
                        title={item.event}
                        meta={`${item.area} · Expires ${formatDateTime(item.expires)}`}
                        onClick={() => setSelected({ id: item.id, kind: "weather" })}
                        badge={
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                              selected?.kind === "weather" && selected.id === item.id
                                ? "bg-white/10 text-white/75"
                                : severityClass(item.severity)
                            }`}
                          >
                            {item.severity}
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                      No weather alerts available right now.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
