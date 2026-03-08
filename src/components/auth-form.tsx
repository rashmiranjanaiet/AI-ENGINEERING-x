"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

type AuthResponse = {
  error?: string;
};

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = (await response.json().catch(() => null)) as AuthResponse | null;

    if (!response.ok) {
      setError(data?.error ?? "Unable to continue right now.");
      return;
    }

    startTransition(() => {
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="panel-glow rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_24px_80px_rgba(15,34,56,0.14)] sm:p-8">
      <div className="mb-6 flex rounded-full border border-slate-200/80 bg-slate-900/5 p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "login"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "register"
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-600"
          }`}
        >
          Create account
        </button>
      </div>

      <div className="mb-6 space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">
          Airscope access
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          {mode === "login" ? "Welcome back to the radar." : "Start tracking flights."}
        </h2>
        <p className="text-sm leading-6 text-slate-600">
          {mode === "login"
            ? "Sign in to open the live flight map and inspect aircraft details."
            : "Create an account to unlock the world map, route tracking, and live aircraft data."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Captain name"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400"
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="pilot@airscope.com"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            required
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-400"
          />
        </label>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Please wait..."
            : mode === "login"
              ? "Open live radar"
              : "Create account and continue"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        <span>MongoDB-backed accounts</span>
        <span>Server-side AirLabs proxy</span>
      </div>
    </div>
  );
}
