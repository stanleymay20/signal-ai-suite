import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Play, Loader2, AlertTriangle, Info, AlertCircle, TrendingUp,
  TrendingDown, Minus, Activity,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceDot, Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getDataset } from "@/lib/datasets.functions";
import { runDatasetAnalysis, getLatestAnalysis } from "@/lib/analyses.functions";
import { detectTimeSeries } from "@/lib/analysis/detectTimeSeries";
import type {
  AnalysisResult, AnomalyPoint, CorrelationMatrix, DistributionResult,
  Insight, MissingnessEntry, MovingAverageSeries, SeasonalityResult, TimePoint, TrendResult,
} from "@/lib/analysis/types";
import type { ColumnProfile } from "@/lib/data-profiling/types";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId/analysis")({
  head: () => ({ meta: [{ title: "Analysis — TimeSeriesGPT" }] }),
  component: AnalysisPage,
});

function AnalysisPage() {
  const { datasetId } = Route.useParams();
  const qc = useQueryClient();
  const getDs = useServerFn(getDataset);
  const getAna = useServerFn(getLatestAnalysis);
  const runAna = useServerFn(runDatasetAnalysis);

  const dsQ = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDs({ data: { datasetId } }),
  });
  const anaQ = useQuery({
    queryKey: ["analysis", datasetId],
    queryFn: () => getAna({ data: { datasetId } }),
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
      stats: (c.stats ?? {}) as ColumnProfile["stats"],
    }));
  }, [dsQ.data]);

  const candidates = useMemo(() => detectTimeSeries(columnProfiles), [columnProfiles]);
  const lastAnalysis = anaQ.data;

  const [dateCol, setDateCol] = useState<string | "">("");
  const [targetCol, setTargetCol] = useState<string | "">("");
  const [granularity, setGranularity] = useState<string>("");
  const [aggregate, setAggregate] = useState<"mean" | "sum">("mean");

  // Seed selections from candidates / last analysis when data lands
  const seedKey = `${columnProfiles.length}|${lastAnalysis?.id ?? ""}`;
  useMemoEffect(() => {
    if (lastAnalysis?.date_column) setDateCol(lastAnalysis.date_column);
    else if (candidates.suggestedDate) setDateCol(candidates.suggestedDate);
    if (lastAnalysis?.target_column) setTargetCol(lastAnalysis.target_column);
    else if (candidates.suggestedTarget) setTargetCol(candidates.suggestedTarget);
    if (lastAnalysis?.granularity) setGranularity(lastAnalysis.granularity);
  }, seedKey);

  const runMut = useMutation({
    mutationFn: () =>
      runAna({
        data: {
          datasetId,
          dateColumn: dateCol || null,
          targetColumn: targetCol || null,
          granularity: (granularity || undefined) as
            | "day" | "week" | "month" | "quarter" | "year" | undefined,
          aggregate,
        },
      }),
    onSuccess: () => {
      toast.success("Analysis complete");
      qc.invalidateQueries({ queryKey: ["analysis", datasetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (dsQ.isLoading) {
    return <AppShell title="Loading…"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></AppShell>;
  }
  if (dsQ.isError || !dsQ.data) {
    return (
      <AppShell title="Dataset not found">
        <Link to="/datasets" className="text-sm text-primary hover:underline">← Back to datasets</Link>
      </AppShell>
    );
  }

  const { dataset } = dsQ.data;
  const ready = dataset.status === "ready";
  const result = (lastAnalysis?.status === "ready" ? lastAnalysis.results_json : null) as
    | AnalysisResult | null;

  return (
    <AppShell
      title="Exploratory analysis"
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
          Dataset is not ready for analysis. Current status: <span className="font-mono">{dataset.status}</span>
        </div>
      )}

      {ready && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold">Configure analysis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a date column and a numeric target to compute trends, seasonality, and anomaly candidates.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Field label="Date column">
              <select className="select" value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                <option value="">— None —</option>
                {candidates.dateColumns.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Target (numeric)">
              <select className="select" value={targetCol} onChange={(e) => setTargetCol(e.target.value)}>
                <option value="">— None —</option>
                {candidates.numericColumns.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Granularity">
              <select className="select" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
                <option value="">Auto</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </Field>
            <Field label="Aggregate">
              <select className="select" value={aggregate} onChange={(e) => setAggregate(e.target.value as "mean" | "sum")}>
                <option value="mean">Mean</option>
                <option value="sum">Sum</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending || lastAnalysis?.status === "running"}
            >
              {runMut.isPending || lastAnalysis?.status === "running" ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Play className="mr-1 h-4 w-4" /> Run analysis</>
              )}
            </Button>
            {lastAnalysis?.status === "failed" && (
              <span className="text-sm text-destructive">
                Last run failed: {lastAnalysis.error_message ?? "unknown error"}
              </span>
            )}
            {lastAnalysis && lastAnalysis.status === "ready" && (
              <span className="text-xs text-muted-foreground">
                Last run {new Date(lastAnalysis.created_at).toLocaleString()}
              </span>
            )}
          </div>
        </section>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <InsightsCard insights={result.insights} />

          {result.trend && (
            <TrendCard
              series={result.series}
              trend={result.trend}
              movingAverages={result.movingAverages}
              anomalies={result.anomalies}
              targetColumn={result.targetColumn}
              granularity={result.granularity}
            />
          )}

          {result.seasonality && <SeasonalityCard seasonality={result.seasonality} />}

          {result.distributions.length > 0 && <DistributionsCard distributions={result.distributions} />}

          {result.correlation && <CorrelationCard matrix={result.correlation} />}

          <MissingnessCard items={result.missingness} />

          {result.anomalies.length > 0 && <AnomaliesCard anomalies={result.anomalies} />}
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

/* tiny effect helper that re-runs only when a key string changes */
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
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
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

function InsightsCard({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <Card title="Automatic insights"><p className="text-sm text-muted-foreground">No notable insights detected.</p></Card>;
  }
  return (
    <Card title="Automatic insights">
      <ul className="space-y-3">
        {insights.map((i, idx) => {
          const Icon = i.severity === "critical" ? AlertTriangle : i.severity === "warning" ? AlertCircle : Info;
          const tone = i.severity === "critical" ? "text-destructive"
            : i.severity === "warning" ? "text-gold-foreground" : "text-emerald";
          return (
            <li key={idx} className="flex items-start gap-3 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`} />
              <div>
                <p>{i.message}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{i.code}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TrendCard({
  series, trend, movingAverages, anomalies, targetColumn, granularity,
}: {
  series: TimePoint[]; trend: TrendResult; movingAverages: MovingAverageSeries[];
  anomalies: AnomalyPoint[]; targetColumn: string | null; granularity: string | null;
}) {
  const chartData = useMemo(() => {
    const byT: Record<string, { t: string; v: number } & Record<string, number | null>> = {};
    for (const p of series) byT[p.t] = { t: p.t, v: p.v };
    for (const ma of movingAverages) {
      for (const p of ma.points) {
        if (byT[p.t]) (byT[p.t] as Record<string, number | null>)[`ma${ma.window}`] = p.ma;
      }
    }
    return Object.values(byT);
  }, [series, movingAverages]);

  const anomalySet = new Set(anomalies.map((a) => a.t));
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const tone = trend.direction === "up" ? "text-emerald"
    : trend.direction === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card
      title={`Trend — ${targetColumn ?? "value"}${granularity ? ` (${granularity})` : ""}`}
      action={
        <div className={`flex items-center gap-2 text-sm ${tone}`}>
          <Icon className="h-4 w-4" />
          <span className="font-mono tabular-nums">
            {trend.changePct === null ? "n/a" : `${trend.changePct >= 0 ? "+" : ""}${trend.changePct.toFixed(1)}%`}
          </span>
          <span className="text-xs text-muted-foreground">R²={trend.rSquared.toFixed(2)}</span>
        </div>
      }
    >
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tickFormatter={(t) => formatT(t)} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={56} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))",
                borderRadius: 8, fontSize: 12,
              }}
              labelFormatter={(t) => new Date(String(t)).toLocaleDateString()}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="v" name={targetColumn ?? "value"}
              stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
            {movingAverages.map((ma, i) => (
              <Line key={ma.window} type="monotone" dataKey={`ma${ma.window}`} name={`MA${ma.window}`}
                stroke={i === 0 ? "hsl(var(--gold))" : "hsl(var(--emerald))"}
                strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
            ))}
            {series.filter((p) => anomalySet.has(p.t)).map((p) => (
              <ReferenceDot key={p.t} x={p.t} y={p.v} r={5}
                fill="hsl(var(--destructive))" stroke="hsl(var(--destructive))" />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {series.length} buckets · slope {trend.slopePerDay.toFixed(4)}/day · {anomalies.length} anomalies marked
      </p>
    </Card>
  );
}

function SeasonalityCard({ seasonality }: { seasonality: SeasonalityResult }) {
  return (
    <Card title="Seasonality" action={
      <span className="font-mono text-xs text-muted-foreground">
        strength {seasonality.strength} · {seasonality.detected ? "detected" : "weak / none"}
      </span>
    }>
      <div className="grid gap-6 md:grid-cols-2">
        <SeasonalityChart title="Mean by month" data={seasonality.monthOfYear} />
        <SeasonalityChart title="Mean by day of week" data={seasonality.dayOfWeek} />
      </div>
    </Card>
  );
}

function SeasonalityChart({ title, data }: { title: string; data: Array<{ label: string; mean: number; count: number }> }) {
  return (
    <div>
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={48} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="mean" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DistributionsCard({ distributions }: { distributions: DistributionResult[] }) {
  return (
    <Card title="Distributions">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {distributions.map((d) => (
          <div key={d.column} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-xs font-semibold">{d.column}</h3>
              <span className="font-mono text-[10px] text-muted-foreground">n={d.count}</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer>
                <BarChart data={d.bins} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-muted-foreground">
              <Stat k="min" v={fmtNum(d.min)} />
              <Stat k="median" v={fmtNum(d.median)} />
              <Stat k="max" v={fmtNum(d.max)} />
              <Stat k="μ" v={fmtNum(d.mean)} />
              <Stat k="σ" v={fmtNum(d.stddev)} />
              <Stat k="IQR" v={`${fmtNum(d.p25)}–${fmtNum(d.p75)}`} />
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div><dt className="inline">{k}: </dt><dd className="inline text-foreground">{v}</dd></div>;
}

function CorrelationCard({ matrix }: { matrix: CorrelationMatrix }) {
  return (
    <Card title="Correlation matrix" action={<span className="font-mono text-[10px] text-muted-foreground">Pearson</span>}>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1" />
              {matrix.columns.map((c) => (
                <th key={c} className="px-2 py-1 font-mono text-[10px] text-muted-foreground">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.columns.map((row, i) => (
              <tr key={row}>
                <th className="px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">{row}</th>
                {matrix.columns.map((_, j) => {
                  const r = matrix.values[i][j];
                  const bg = r === null
                    ? "hsl(var(--muted))"
                    : r > 0
                      ? `color-mix(in oklab, hsl(var(--emerald)) ${Math.round(Math.abs(r) * 80)}%, transparent)`
                      : `color-mix(in oklab, hsl(var(--destructive)) ${Math.round(Math.abs(r) * 80)}%, transparent)`;
                  return (
                    <td key={j} className="px-2 py-1 text-center font-mono tabular-nums"
                      style={{ background: bg, minWidth: 56 }}>
                      {r === null ? "—" : r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MissingnessCard({ items }: { items: MissingnessEntry[] }) {
  const sorted = [...items].sort((a, b) => b.percentage - a.percentage);
  return (
    <Card title="Missingness by column">
      <ul className="space-y-2">
        {sorted.map((m) => (
          <li key={m.column} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs">{m.column}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{m.percentage}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-destructive/70" style={{ width: `${Math.min(100, m.percentage)}%` }} />
              </div>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
              {m.missing.toLocaleString()} / {m.total.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AnomaliesCard({ anomalies }: { anomalies: AnomalyPoint[] }) {
  return (
    <Card title="Anomaly candidates" action={
      <span className="font-mono text-[10px] text-muted-foreground"><Activity className="inline h-3 w-3" /> z-score ≥ 3</span>
    }>
      <ul className="divide-y divide-border text-sm">
        {anomalies.map((a, i) => (
          <li key={i} className="flex items-center justify-between py-2">
            <span className="font-mono text-xs">{new Date(a.t).toLocaleDateString()}</span>
            <span className="font-mono tabular-nums">{fmtNum(a.v)}</span>
            <span className="font-mono text-xs text-destructive">z={a.zScore}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatT(t: string): string {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toISOString().slice(0, 10);
}
function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
