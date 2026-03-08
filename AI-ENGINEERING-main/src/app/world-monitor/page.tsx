import type { Metadata } from "next";
import { redirect } from "next/navigation";

import WorldMonitorDashboard from "@/components/world-monitor-dashboard";
import { getSession } from "@/lib/auth";
import { getWorldMonitorDashboardData } from "@/lib/world-monitor";

export const metadata: Metadata = {
  title: "Airscope | World Monitor",
  description:
    "A global monitoring dashboard with earthquakes, natural events, weather alerts, and a live world clock.",
};

export default async function WorldMonitorPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const data = await getWorldMonitorDashboardData();

  return <WorldMonitorDashboard data={data} user={session} />;
}
