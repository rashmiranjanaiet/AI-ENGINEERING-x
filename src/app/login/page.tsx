import { redirect } from "next/navigation";

import AuthForm from "@/components/auth-form";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_480px]">
        <section className="panel-glow rounded-[34px] border border-white/60 bg-white/72 p-8 shadow-[0_24px_80px_rgba(15,34,56,0.14)] sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.34em] text-slate-500">
            Flight intelligence platform
          </p>

          <div className="mt-6 max-w-3xl space-y-4">
            <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
              A live world map for aircraft tracking.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              Sign in to open a radar-style dashboard that plots live airplanes,
              exposes flight details on click, and shows the route from departure
              airport to destination.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] bg-slate-950 px-5 py-6 text-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-white/60">
                Live motion
              </p>
              <p className="mt-4 text-2xl font-semibold">World aircraft map</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Watch planes update on the map with recurring live refreshes.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Click for details
              </p>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                Flight information
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                View airline, callsign, speed, altitude, and route status.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-white/85 px-5 py-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Route tracking
              </p>
              <p className="mt-4 text-2xl font-semibold text-slate-950">
                Departure to arrival
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Highlight the airport pair and follow the full trip line.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/85 p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Included
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <li>Live aircraft markers across the globe</li>
                <li>Search by flight code, airline, route, or aircraft type</li>
                <li>MongoDB-backed login and registration flow</li>
              </ul>
            </div>

            <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/85 p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                Data note
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-700">
                AirLabs is used server-side so the API key stays off the client.
                The current refresh interval is set to protect the provided free-tier
                quota while still keeping the map live.
              </p>
            </div>
          </div>
        </section>

        <AuthForm />
      </div>
    </main>
  );
}
