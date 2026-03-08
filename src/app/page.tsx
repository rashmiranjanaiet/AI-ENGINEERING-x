import { redirect } from "next/navigation";

import FlightDashboard from "@/components/flight-dashboard";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <FlightDashboard user={session} />;
}
