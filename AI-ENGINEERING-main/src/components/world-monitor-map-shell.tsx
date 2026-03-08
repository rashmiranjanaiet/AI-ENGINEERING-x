"use client";

import dynamic from "next/dynamic";

const WorldMonitorMap = dynamic(() => import("@/components/world-monitor-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-200/60 text-sm text-slate-600">
      Loading incident map...
    </div>
  ),
});

export default WorldMonitorMap;
