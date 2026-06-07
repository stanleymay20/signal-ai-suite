import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Database, FolderKanban, MessageSquare, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TimeSeriesGPT" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const profileQ = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const wsQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const displayName =
    profileQ.data?.full_name?.trim() || user.email?.split("@")[0] || "operator";

  const stats = [
    { label: "Workspaces", value: wsQ.data?.length ?? 0, icon: FolderKanban },
    { label: "Datasets", value: 0, icon: Database, hint: "Phase 2" },
    { label: "Forecasts", value: 0, icon: TrendingUp, hint: "Phase 4" },
    { label: "Conversations", value: 0, icon: MessageSquare, hint: "Phase 6" },
  ];

  return (
    <AppShell
      title={`Good to see you, ${displayName}.`}
      subtitle="Your TimeSeriesGPT command center."
      actions={
        <Link to="/workspaces">
          <Button size="sm">
            Manage workspaces <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      }
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
              <Icon className="h-4 w-4 text-emerald" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
            {hint && (
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Roadmap */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="font-display text-xl font-semibold">Build roadmap</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 1 is live. Upcoming phases unlock once foundation is hardened.
          </p>
          <ol className="mt-5 space-y-3">
            {ROADMAP.map((p) => (
              <li
                key={p.n}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full font-mono text-xs font-semibold ${
                    p.status === "done"
                      ? "bg-emerald text-emerald-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.n}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.body}</p>
                </div>
                <span
                  className={`text-xs font-mono uppercase tracking-widest ${
                    p.status === "done" ? "text-emerald" : "text-muted-foreground"
                  }`}
                >
                  {p.status === "done" ? "live" : "next"}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Your workspaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-tenant by design. RLS enforced.
          </p>
          <div className="mt-4 space-y-2">
            {wsQ.isLoading && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {wsQ.data?.slice(0, 4).map((w) => (
              <Link
                key={w.id}
                to="/workspaces/$workspaceId"
                params={{ workspaceId: w.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition hover:border-emerald/50"
              >
                <span className="truncate font-medium">{w.name}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            {wsQ.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No workspaces yet.</p>
            )}
          </div>
          <Link to="/workspaces">
            <Button variant="outline" size="sm" className="mt-4 w-full">
              View all
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

const ROADMAP = [
  { n: 1, name: "Foundation", body: "Auth, profiles, workspaces, RLS, audit", status: "done" },
  { n: 2, name: "Data Ingestion", body: "CSV/Excel/TSV upload, profiling, health score", status: "next" },
  { n: 3, name: "Exploratory Analysis", body: "Trends, seasonality, correlations", status: "next" },
  { n: 4, name: "Forecasting Engine", body: "Prophet, ARIMA, SARIMA, XGBoost", status: "next" },
  { n: 5, name: "Anomaly Detection", body: "Isolation Forest, Z-score, IQR", status: "next" },
  { n: 6, name: "AI Chat", body: "Grounded conversational analytics", status: "next" },
] as const;
