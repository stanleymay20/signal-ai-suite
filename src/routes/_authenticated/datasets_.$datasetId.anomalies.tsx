import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Play, Loader2, AlertTriangle, Download, Filter } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getDataset } from "@/lib/datasets.functions";
import { runAnomalyDetectionFn, getLatestAnomalyRun } from "@/lib/anomalies.functions";
import { detectTimeSeries } from "@/lib/analysis/detectTimeSeries";
import type { ColumnProfile } from "@/lib/data-profiling/types";
import type { TimePoint } from "@/lib/analysis/types";
import type {
  AnomalyMethod,
  AnomalyResult,
  AnomalySeverity,
  AnomalySummary,
} from "@/lib/anomalies/types";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId/anomalies")({
  head: () => ({ meta: [{ title: "Anomalies — Signal AI Suite" }] }),
  component: AnomaliesPage,
});

const METHOD_LABELS: Record<AnomalyMethod, string> = {
  zscore: "Z-score",
  mad: "MAD (robust)",
  iqr: "IQR",
  rolling_zscore: "Rolling Z",
  forecast_residual: "Forecast residual",
};

const ALL_METHODS: AnomalyMethod[] = [
  "zscore",
  "mad",
  "iqr",
  "rolling_zscore",
  "forecast_residual",
];
const ALL_SEVERITIES: AnomalySeverity[] = ["low", "medium", "high", "critical"];

function AnomaliesPage() {
  const { datasetId } = Route.useParams();
  const qc = useQueryClient();
  const getDs = useServerFn(getDataset);
  const getRun = useServerFn(getLatestAnomalyRun);
  const runDetect = useServerFn(runAnomalyDetectionFn);

  const dsQ = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDs({ data: { datasetId } }),
  });
  const runQ = useQuery({
    queryKey: ["anomaly-run", datasetId],
    queryFn: () => getRun({ data: { datasetId } }),
    refetchInterval: (q) => (q.state.data?.status === "running" ? 1500 : false),
  });

  const columnProfiles: ColumnProfile[] = useMemo(() => {
    const cs = dsQ.data?.columns ?? [];
    return cs.map((c) => ({
      name: c.column_name,
      position: c.position,
      dataType: c.data_type,
      nullable: c.nullable,
      uniqueRatio: c.unique_ratio ?? 0,
      missingPercentage: c.missing_percentage ?? 0,
      stats: (c.stats ?? {}) as unknown as ColumnProfile["stats"],
    }));
  }, [dsQ.data]);

  const candidates = useMemo(() => detectTimeSeries(columnProfiles), [columnProfiles]);
  const last = runQ.data;

  const [dateCol, setDateCol] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [granularity, setGranularity] = useState("");
  const [aggregate, setAggregate] = useState<"mean" | "sum">("mean");
  const [enabledMethods, setEnabledMethods] = useState<Set<AnomalyMethod>>(new Set(ALL_METHODS));
  const [methodFilter, setMethodFilter] = useState<Set<AnomalyMethod>>(new Set(ALL_METHODS));
  const [sevFilter, setSevFilter] = useState<Set<AnomalySeverity>>(new Set(ALL_SEVERITIES));

  const seedKey = `${columnProfiles.length}|${last?.id ?? ""}`;
  useMemoEffect(() => {
    if (last?.date_column) setDateCol(last.date_column);
    else if (candidates.suggestedDate) setDateCol(candidates.suggestedDate);
    if (last?.target_column) setTargetCol(last.target_column);
    else if (candidates.suggestedTarget) setTargetCol(candidates.suggestedTarget);
    if (last?.granularity) setGranularity(last.granularity);
  }, seedKey);

  const runMut = useMutation({
    mutationFn: () =>
      runDetect({
        data: {
          datasetId,
          dateColumn: dateCol,
          targetColumn: targetCol,
          granularity: (granularity || undefined) as
            | "day"
            | "week"
            | "month"
            | "quarter"
            | "year"
            | undefined,
          aggregate,
          methods: Array.from(enabledMethods),
        },
      }),
    onSuccess: () => {
      toast.success("Anomaly detection complete");
      qc.invalidateQueries({ queryKey: ["anomaly-run", datasetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (dsQ.isLoading) {
    return (
      <AppShell title="Loading…">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </AppShell>
    );
  }
  if (dsQ.isError || !dsQ.data) {
    return (
      <AppShell title="Dataset not found">
        <Link to="/datasets" className="text-sm text-primary hover:underline">
          ← Back to datasets
        </Link>
      </AppShell>
    );
  }

  const { dataset } = dsQ.data;
  const ready = dataset.status === "ready";

  const series: TimePoint[] = Array.isArray(last?.series)
    ? (last!.series as unknown as TimePoint[])
    : [];
  const allAnomalies: AnomalyResult[] = Array.isArray(last?.anomalies)
    ? (last!.anomalies as unknown as AnomalyResult[])
    : [];
  const summary = (last?.summary ?? {}) as Partial<AnomalySummary>;

  const filteredAnomalies = allAnomalies.filter(
    (a) => methodFilter.has(a.method) && sevFilter.has(a.severity),
  );

  return (
    <AppShell
      title="Anomalies"
      subtitle={dataset.filename}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/datasets/$datasetId" params={{ datasetId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
      }
    >
      {!ready && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          Dataset is not ready. Current status: <span className="font-mono">{dataset.status}</span>
        </div>
      )}

      {ready && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold">Configure detection</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs all selected methods deterministically. Forecast residual uses your most recent
            forecast if available.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Field label="Date column">
              <select
                className="select"
                value={dateCol}
                onChange={(e) => setDateCol(e.target.value)}
              >
                <option value="">— Select —</option>
                {candidates.dateColumns.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target (numeric)">
              <select
                className="select"
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
              >
                <option value="">— Select —</option>
                {candidates.numericColumns.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Granularity">
              <select
                className="select"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
              >
                <option value="">Auto</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </Field>
            <Field label="Aggregate">
              <select
                className="select"
                value={aggregate}
                onChange={(e) => setAggregate(e.target.value as "mean" | "sum")}
              >
                <option value="mean">Mean</option>
                <option value="sum">Sum</option>
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Methods
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_METHODS.map((m) => {
                const on = enabledMethods.has(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleSet(enabledMethods, m, setEnabledMethods)}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => runMut.mutate()}
              disabled={
                !dateCol ||
                !targetCol ||
                enabledMethods.size === 0 ||
                runMut.isPending ||
                last?.status === "running"
              }
            >
              {runMut.isPending || last?.status === "running" ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Detecting…
                </>
              ) : (
                <>
                  <Play className="mr-1 h-4 w-4" /> Run detection
                </>
              )}
            </Button>
            {last?.status === "failed" && (
              <span className="text-sm text-destructive">
                Last run failed: {last.error_message ?? "unknown error"}
              </span>
            )}
            {last?.status === "ready" && (
              <span className="text-xs text-muted-foreground">
                Last run {new Date(last.created_at).toLocaleString()} · {allAnomalies.length}{" "}
                anomalies
              </span>
            )}
          </div>
        </section>
      )}

      {last?.status === "ready" && series.length > 0 && (
        <div className="mt-6 space-y-6">
          <SummaryCards summary={summary} totalShown={filteredAnomalies.length} />

          <FilterBar
            methodFilter={methodFilter}
            setMethodFilter={setMethodFilter}
            sevFilter={sevFilter}
            setSevFilter={setSevFilter}
          />

          <AnomalyChartCard
            series={series}
            anomalies={filteredAnomalies}
            targetColumn={last.target_column ?? ""}
          />

          <ExplanationCards anomalies={filteredAnomalies} />

          <AnomalyTable
            anomalies={filteredAnomalies}
            onExport={() => exportCsv(filteredAnomalies, dataset.filename)}
          />
        </div>
      )}

      <style>{`
        .select {
          width: 100%; padding: 0.5rem 0.625rem; border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)); background: hsl(var(--background));
          font-size: 0.875rem;
        }
        .select:focus { outline: 2px solid hsl(var(--primary)); outline-offset: 1px; }
      `}</style>
    </AppShell>
  );
}

function toggleSet<T>(set: Set<T>, v: T, setter: (s: Set<T>) => void) {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  setter(next);
}

function useMemoEffect(fn: () => void, key: string) {
  const [seen, setSeen] = useState<string | null>(null);
  if (seen !== key) {
    setSeen(key);
    fn();
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SummaryCards({
  summary,
  totalShown,
}: {
  summary: Partial<AnomalySummary>;
  totalShown: number;
}) {
  const sev = summary.bySeverity ?? { low: 0, medium: 0, high: 0, critical: 0 };
  const byMethod = summary.byMethod ?? {
    zscore: 0,
    mad: 0,
    iqr: 0,
    rolling_zscore: 0,
    forecast_residual: 0,
  };
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat k="Total points" v={String(summary.totalPoints ?? 0)} />
      <Stat k="Total anomalies" v={String(summary.totalAnomalies ?? 0)} />
      <Stat k="Currently shown" v={String(totalShown)} />
      <Stat k="Severity mix" v={`${sev.critical}C / ${sev.high}H / ${sev.medium}M / ${sev.low}L`} />
      <div className="md:col-span-4 grid gap-3 md:grid-cols-5">
        {ALL_METHODS.map((m) => (
          <Stat key={m} k={METHOD_LABELS[m]} v={String(byMethod[m] ?? 0)} small />
        ))}
      </div>
    </div>
  );
}

function Stat({ k, v, small }: { k: string; v: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {k}
      </div>
      <div className={`mt-1 font-display tabular-nums ${small ? "text-base" : "text-xl"}`}>{v}</div>
    </div>
  );
}

function FilterBar({
  methodFilter,
  setMethodFilter,
  sevFilter,
  setSevFilter,
}: {
  methodFilter: Set<AnomalyMethod>;
  setMethodFilter: (s: Set<AnomalyMethod>) => void;
  sevFilter: Set<AnomalySeverity>;
  setSevFilter: (s: Set<AnomalySeverity>) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="font-mono text-[10px] uppercase tracking-widest">Methods</span>
        </div>
        {ALL_METHODS.map((m) => {
          const on = methodFilter.has(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleSet(methodFilter, m, setMethodFilter)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {METHOD_LABELS[m]}
            </button>
          );
        })}
        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Severity
        </span>
        {ALL_SEVERITIES.map((s) => {
          const on = sevFilter.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSet(sevFilter, s, setSevFilter)}
              className={`rounded-md border px-2.5 py-1 text-xs capitalize ${
                on ? `${severityBorder(s)} ${severityBg(s)}` : "border-border text-muted-foreground"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnomalyChartCard({
  series,
  anomalies,
  targetColumn,
}: {
  series: TimePoint[];
  anomalies: AnomalyResult[];
  targetColumn: string;
}) {
  const data = useMemo(() => {
    const flagged = new Map(anomalies.map((a) => [a.t, a]));
    return series.map((p) => ({
      t: p.t,
      v: p.v,
      anomaly: flagged.has(p.t) ? p.v : null,
    }));
  }, [series, anomalies]);

  return (
    <Card
      title={`Time series — ${targetColumn || "value"}`}
      action={
        <span className="flex items-center gap-2 font-mono text-xs text-destructive">
          <AlertTriangle className="h-4 w-4" /> {anomalies.length} flagged
        </span>
      }
    >
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="t"
              tickFormatter={(t) => formatT(String(t))}
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={56} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(t) => new Date(String(t)).toLocaleDateString()}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="v"
              name="Value"
              stroke="hsl(var(--primary))"
              dot={false}
              strokeWidth={2}
            />
            <Scatter dataKey="anomaly" name="Anomaly" fill="hsl(var(--destructive))" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ExplanationCards({ anomalies }: { anomalies: AnomalyResult[] }) {
  const top = [...anomalies].sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 6);
  if (top.length === 0) return null;
  return (
    <Card
      title="Top anomaly explanations"
      action={<span className="font-mono text-[10px] text-muted-foreground">ranked by score</span>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {top.map((a, i) => (
          <div
            key={`${a.t}-${a.method}-${i}`}
            className={`rounded-lg border p-3 ${severityBorder(a.severity)}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs">{formatT(a.t)}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] capitalize ${severityBg(a.severity)}`}
              >
                {a.severity}
              </span>
            </div>
            <div className="mt-2 font-display text-base tabular-nums">
              {fmtNum(a.observed)}
              {a.expected !== null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  vs expected {fmtNum(a.expected)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{a.explanation}</p>
            <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span>{METHOD_LABELS[a.method]}</span>
              <span>score {a.score}</span>
              {a.impactPct !== null && <span>impact ~{a.impactPct}%</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnomalyTable({
  anomalies,
  onExport,
}: {
  anomalies: AnomalyResult[];
  onExport: () => void;
}) {
  return (
    <Card
      title="All anomalies"
      action={
        <Button variant="outline" size="sm" onClick={onExport} disabled={anomalies.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      }
    >
      {anomalies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No anomalies match the current filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-2 py-2">Timestamp</th>
                <th className="px-2 py-2">Method</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2 text-right">Observed</th>
                <th className="px-2 py-2 text-right">Expected</th>
                <th className="px-2 py-2 text-right">Deviation</th>
                <th className="px-2 py-2 text-right">Score</th>
                <th className="px-2 py-2 text-right">Impact %</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => (
                <tr key={`${a.t}-${a.method}-${i}`}>
                  <td className="border-t border-border px-2 py-2 font-mono text-xs">
                    {formatT(a.t)}
                  </td>
                  <td className="border-t border-border px-2 py-2">{METHOD_LABELS[a.method]}</td>
                  <td className="border-t border-border px-2 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] capitalize ${severityBg(a.severity)}`}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                    {fmtNum(a.observed)}
                  </td>
                  <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                    {fmtNum(a.expected)}
                  </td>
                  <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                    {fmtNum(a.deviation)}
                  </td>
                  <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                    {a.score}
                  </td>
                  <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                    {a.impactPct === null ? "—" : `${a.impactPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function severityBg(s: AnomalySeverity): string {
  switch (s) {
    case "critical":
      return "bg-destructive/20 text-destructive";
    case "high":
      return "bg-gold/20 text-gold";
    case "medium":
      return "bg-primary/15 text-primary";
    case "low":
      return "bg-muted text-muted-foreground";
  }
}

function severityBorder(s: AnomalySeverity): string {
  switch (s) {
    case "critical":
      return "border-destructive";
    case "high":
      return "border-gold";
    case "medium":
      return "border-primary";
    case "low":
      return "border-border";
  }
}

function exportCsv(rows: AnomalyResult[], filename: string) {
  const header = [
    "timestamp",
    "method",
    "severity",
    "observed",
    "expected",
    "deviation",
    "score",
    "impact_pct",
    "explanation",
  ];
  const lines = [header.join(",")];
  for (const a of rows) {
    lines.push(
      [
        a.t,
        a.method,
        a.severity,
        a.observed,
        a.expected ?? "",
        a.deviation ?? "",
        a.score,
        a.impactPct ?? "",
        csvEscape(a.explanation),
      ].join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, "")}-anomalies.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatT(t: string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toISOString().slice(0, 10);
}
function fmtNum(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
