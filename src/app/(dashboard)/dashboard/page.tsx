import { createServerClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [scansResult, profileResult] = await Promise.all([
    supabase
      .from("scans")
      .select("*, measurements(processing_metadata)")
      .eq("worker_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scans = (scansResult.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileResult.data as any;

  const stats = {
    total: scans.length,
    passed: scans.filter((s) => s.measurements?.processing_metadata?.autoPassed === true).length,
    rejected: scans.filter((s) => s.measurements?.processing_metadata?.autoPassed === false).length,
    pending: scans.filter((s) => {
      const ap = s.measurements?.processing_metadata?.autoPassed;
      return ap !== true && ap !== false;
    }).length,
  };

  return <DashboardClient recentScans={scans} stats={stats} profile={profile} />;
}
