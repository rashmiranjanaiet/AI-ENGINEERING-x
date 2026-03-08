import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getNasaDashboardData,
  type NasaApod,
  type NasaImageSpotlight,
  type NasaNeoApproach,
} from "@/lib/nasa";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Airscope | NASA Data",
  description:
    "A NASA mission dashboard with astronomy imagery, asteroid activity, and archive highlights.",
};

async function logout() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatCompactNumber(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatKilometers(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${Math.round(value).toLocaleString()} km`;
}

function formatVelocity(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return `${Math.round(value).toLocaleString()} km/h`;
}

function trimCopy(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function NasaSpotlightCard({
  eyebrow,
  spotlight,
}: {
  eyebrow: string;
  spotlight: NasaImageSpotlight | null;
}) {
  return (
    <section className="panel-glow overflow-hidden rounded-[30px] border border-white/60 bg-white/78 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
      {spotlight ? (
        <>
          <div className="aspect-[16/10] overflow-hidden bg-slate-950">
            <img
              src={spotlight.imageUrl}
              alt={spotlight.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4 p-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {spotlight.title}
              </h2>
            </div>

            <p className="text-sm leading-7 text-slate-600">
              {trimCopy(spotlight.description, 220)}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Source center
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {spotlight.center ?? "NASA archive"}
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Captured
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {formatDate(spotlight.dateCreated)}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
            {eyebrow}
          </p>
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
            This NASA archive section is unavailable right now.
          </div>
        </div>
      )}
    </section>
  );
}

function ApodPanel({ apod }: { apod: NasaApod | null }) {
  if (!apod) {
    return (
      <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
          Astronomy Picture of the Day
        </p>
        <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
          APOD is unavailable right now.
        </div>
      </section>
    );
  }

  return (
    <section className="panel-glow overflow-hidden rounded-[32px] border border-white/60 bg-white/78 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="min-h-[420px] bg-slate-950">
          {apod.mediaType === "image" ? (
            <img
              src={apod.imageUrl}
              alt={apod.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <iframe
              src={apod.imageUrl}
              title={apod.title}
              className="h-full min-h-[420px] w-full"
              allow="fullscreen"
            />
          )}
        </div>

        <div className="flex flex-col justify-between gap-6 p-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">
              Astronomy Picture of the Day
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              {apod.title}
            </h2>
            <p className="mt-3 text-sm text-slate-500">{formatDate(apod.date)}</p>
          </div>

          <p className="text-sm leading-7 text-slate-600">
            {trimCopy(apod.explanation, 700)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
                Media type
              </p>
              <p className="mt-3 text-2xl font-semibold capitalize">
                {apod.mediaType}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Credit
              </p>
              <p className="mt-3 text-base font-semibold text-slate-950">
                {apod.copyright ?? "NASA"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NeoTopLine({
  label,
  value,
  detail,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function NeoApproachRow({ approach }: { approach: NasaNeoApproach }) {
  return (
    <a
      href={approach.jplUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-[22px] border border-slate-200/80 bg-white/85 px-4 py-4 transition hover:border-slate-400"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-slate-950">{approach.name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {formatKilometers(approach.missDistanceKm)} away
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            approach.hazardous
              ? "bg-rose-100 text-rose-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {approach.hazardous ? "Hazardous" : "Observed"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div>
          <p>Velocity</p>
          <p className="mt-1 font-medium text-slate-950">
            {formatVelocity(approach.relativeVelocityKph)}
          </p>
        </div>

        <div>
          <p>Max diameter</p>
          <p className="mt-1 font-medium text-slate-950">
            {formatCompactNumber(approach.diameterKmMax)} km
          </p>
        </div>
      </div>
    </a>
  );
}

export default async function NasaPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const data = await getNasaDashboardData();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="panel-glow rounded-[30px] border border-white/65 bg-white/72 px-6 py-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.34em] text-slate-500">
                NASA mission intelligence
              </p>
              <div className="space-y-2">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Five NASA data feeds in one mission-style dashboard.
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  Track today&apos;s astronomy highlight, asteroid activity, and
                  three archive spotlights covering Earth, Mars, and Artemis.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Logged in
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {session.name}
                </p>
                <p className="text-sm text-slate-600">{session.email}</p>
              </div>

              <Link
                href="/"
                className="rounded-[22px] border border-[#163753] bg-[#163753] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#0f2435]"
              >
                Flight radar
              </Link>

              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-[22px] border border-slate-900 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>

        {data.errors.length ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/95 px-5 py-4 text-sm text-amber-900 shadow-[0_16px_50px_rgba(120,53,15,0.08)]">
            {data.errors.join(" ")}
          </div>
        ) : null}

        <ApodPanel apod={data.apod} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="panel-glow rounded-[30px] border border-white/60 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,34,56,0.14)]">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Near-Earth Objects
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                  Today&apos;s asteroid activity
                </h2>
              </div>

              <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white">
                {data.neoSummary ? formatDate(data.neoSummary.date) : "Unavailable"}
              </span>
            </div>

            {data.neoSummary ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <NeoTopLine
                    label="Tracked"
                    value={data.neoSummary.total.toLocaleString()}
                    detail="Objects listed for today"
                  />
                  <NeoTopLine
                    label="Hazardous"
                    value={data.neoSummary.hazardousCount.toString()}
                    detail="Flagged as potentially hazardous"
                  />
                  <NeoTopLine
                    label="Closest"
                    value={formatKilometers(data.neoSummary.closest?.missDistanceKm)}
                    detail={data.neoSummary.closest?.name ?? "No close approach"}
                  />
                  <NeoTopLine
                    label="Fastest"
                    value={formatVelocity(data.neoSummary.fastest?.relativeVelocityKph)}
                    detail={data.neoSummary.fastest?.name ?? "No velocity sample"}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {data.neoSummary.approaches.map((approach) => (
                    <NeoApproachRow key={approach.id} approach={approach} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                Asteroid tracking data is unavailable right now.
              </div>
            )}
          </section>

          <NasaSpotlightCard
            eyebrow="Earth archive spotlight"
            spotlight={data.earthSpotlight}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <NasaSpotlightCard
            eyebrow="Mars archive spotlight"
            spotlight={data.marsSpotlight}
          />
          <NasaSpotlightCard
            eyebrow="Artemis archive spotlight"
            spotlight={data.artemisSpotlight}
          />
        </div>
      </div>
    </main>
  );
}
