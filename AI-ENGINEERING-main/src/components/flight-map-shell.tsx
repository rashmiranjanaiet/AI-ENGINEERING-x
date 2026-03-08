"use client";

import dynamic from "next/dynamic";

const FlightMap = dynamic(() => import("@/components/flight-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-200/60 text-sm text-slate-600">
      Loading live map...
    </div>
  ),
});

export default FlightMap;
