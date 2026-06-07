import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getSystemHealth,
  isCurrentUserAdmin,
  listUsageEvents,
  listAllUsers,
  setUserRole,
  listAllWorkspaces,
} from "@/lib/admin.functions";
import {
  AlertTriangle,
  Activity,
  DollarSign,
  Cpu,
  Users,
  ShieldAlert,
  Shield,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Control Center — Signal AI Suite" }] }),
  component: AdminPage,
});

function fmt(n: number, digits = 0): string {
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "0";
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function usd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function AdminPage() {
  const qc = useQueryClient();
  const adminFn = useServerFn(isCurrentUserAdmin);
  const healthFn = useServerFn(getSystemHealth);
  const eventsFn = useServerFn(listUsageEvents);
  const usersFn = useServerFn(listAllUsers);
  const workspacesFn = useServerFn(listAllWorkspaces);
  const setRoleFn = useServerFn(setUserRole);

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminFn({ data: undefined as never }),
  });

  const isAdmin = adminQ.data?.isAdmin === true;

  const healthQ = useQuery({
    queryKey: ["admin-health", 24],
    queryFn: () => healthFn({ data: { windowHours: 24 } }),
    enabled: isAdmin,
  });

  const eventsQ = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => eventsFn({ data: { limit: 50 } }),
    enabled: isAdmin,
  });

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => usersFn({ data: { limit: 200 } }),
    enabled: isAdmin,
  });

  const workspacesQ = useQuery({
    queryKey: ["admin-workspaces"],
    queryFn: () => workspacesFn({ data: { limit: 200 } }),
    enabled: isAdmin,
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "member" }) =>
      setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (adminQ.isLoading) {
    return (
      <AppShell title="Admin">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin Control Center" subtitle="Restricted">
        <div className="mx-auto mt-12 max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-lg font-semibold">Admin access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need the <code>admin</code> role to view the observability dashboard.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-emerald hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const health = healthQ.data;
  const o = health?.overview;

  return (
    <AppShell
      title="Admin Control Center"
      subtitle={`Observability · last ${health?.windowHours ?? 24}h`}
    >
      {healthQ.isLoading && <p className="text-sm text-muted-foreground">Loading metrics…</p>}
      {healthQ.error && (
        <p className="text-sm text-destructive">{(healthQ.error as Error).message}</p>
      )}

      {o && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Events"
              value={fmt(o.totalEvents)}
              hint={`${fmt(o.successCount)} success / ${fmt(o.errorCount)} error`}
              icon={Activity}
            />
            <Stat
              label="Error rate"
              value={pct(o.errorRate)}
              tone={o.errorRate > 0.1 ? "danger" : o.errorRate > 0.02 ? "warn" : "ok"}
              icon={AlertTriangle}
            />
            <Stat
              label="Tokens"
              value={fmt(o.totalTokens)}
              hint={`${usd(o.totalCostUsd)} est. AI spend`}
              icon={Cpu}
            />
            <Stat
              label="Latency"
              value={`${fmt(o.p50DurationMs)} ms`}
              hint={`p95 ${fmt(o.p95DurationMs)} ms · avg ${fmt(o.avgDurationMs)} ms`}
              icon={DollarSign}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Panel title="By action" className="lg:col-span-2">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2">Action</th>
                    <th className="py-2 text-right">Count</th>
                    <th className="py-2 text-right">Err%</th>
                    <th className="py-2 text-right">p50</th>
                    <th className="py-2 text-right">p95</th>
                    <th className="py-2 text-right">Tokens</th>
                    <th className="py-2 text-right">$</th>
                  </tr>
                </thead>
                <tbody>
                  {health.byAction.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">No events yet.</td></tr>
                  )}
                  {health.byAction.map((s) => (
                    <tr key={s.action} className="border-t border-border/60">
                      <td className="py-2 font-mono text-xs">{s.action}</td>
                      <td className="py-2 text-right">{fmt(s.count)}</td>
                      <td className={`py-2 text-right ${s.errorRate > 0.1 ? "text-destructive" : ""}`}>
                        {pct(s.errorRate)}
                      </td>
                      <td className="py-2 text-right">{fmt(s.p50DurationMs)}</td>
                      <td className="py-2 text-right">{fmt(s.p95DurationMs)}</td>
                      <td className="py-2 text-right">{fmt(s.totalTokens)}</td>
                      <td className="py-2 text-right">{usd(s.totalCostUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="AI cost · by model">
              {health.byProviderModel.length === 0 && (
                <p className="text-sm text-muted-foreground">No AI calls yet.</p>
              )}
              <ul className="space-y-3">
                {health.byProviderModel.map((s) => (
                  <li key={`${s.provider}/${s.model}`} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{s.provider}/{s.model}</span>
                      <span className="text-sm font-semibold">{usd(s.totalCostUsd)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmt(s.count)} calls · {fmt(s.totalTokens)} tokens
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Panel title="Top users" className="lg:col-span-1">
              {health.topUsers.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity.</p>
              )}
              <ul className="space-y-2">
                {health.topUsers.map((u) => (
                  <li key={u.actorId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{u.actorId.slice(0, 8)}…</span>
                    </span>
                    <span className="font-mono text-xs">{fmt(u.count)} · {usd(u.totalCostUsd)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Recent events" className="lg:col-span-2">
              {eventsQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2">Time</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Status</th>
                      <th className="py-2 text-right">ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(eventsQ.data ?? []).map((e) => (
                      <tr key={e.id} className="border-t border-border/60 align-top">
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-2 font-mono text-xs">{e.action}</td>
                        <td className="py-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              e.status === "success"
                                ? "bg-emerald/20 text-emerald"
                                : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {e.status}
                          </span>
                          {e.error_message && (
                            <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={e.error_message}>
                              {e.error_message}
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono text-xs">{fmt(e.duration_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Panel title="Users" className="lg:col-span-2">
              {usersQ.isLoading && (
                <p className="text-sm text-muted-foreground">Loading users…</p>
              )}
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2">User</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Joined</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersQ.data ?? []).map((u) => {
                      const nextRole = u.role === "admin" ? "member" : "admin";
                      return (
                        <tr key={u.id} className="border-t border-border/60 align-top">
                          <td className="py-2">
                            <div className="font-medium">{u.full_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${
                                u.role === "admin"
                                  ? "bg-emerald/20 text-emerald"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={roleMut.isPending}
                              onClick={() =>
                                roleMut.mutate({ userId: u.id, role: nextRole })
                              }
                            >
                              Make {nextRole}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Workspaces">
              {workspacesQ.isLoading && (
                <p className="text-sm text-muted-foreground">Loading workspaces…</p>
              )}
              <ul className="space-y-2">
                {(workspacesQ.data ?? []).map((w) => (
                  <li
                    key={w.id}
                    className="rounded-lg border border-border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {w.name}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Owner {w.owner_id.slice(0, 8)}… ·{" "}
                      {new Date(w.created_at).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </AppShell>

  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "ok",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-500" : "text-emerald";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <p className={`mt-3 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className ?? ""}`}>
      <h3 className="mb-3 font-display text-base font-semibold">{title}</h3>
      {children}
    </div>
  );
}
