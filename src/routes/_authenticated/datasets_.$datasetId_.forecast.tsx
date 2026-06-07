import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Play, Loader2, TrendingUp, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getDataset } from "@/lib/datasets.functions";
import { runDatasetForecast, getLatestForecast } from "@/lib/forecasts.functions";
import { detectTimeSeries } from "@/lib/analysis/detectTimeSeries";
import type { ColumnProfile } from "@/lib/data-profiling/types";
import type {
  ConfidenceInterval,
  ForecastModel,
  ForecastPoint,
  ModelResult,
  TrainRange,
} from "@/lib/forecasting/types";
import type { TimePoint } from "@/lib/analysis/types";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId/forecast")({
  head: () => ({ meta: [{ title: "Forecast — Signal AI Suite" }] }),
  component: ForecastPage,
});

const MODEL_LABELS: Record<ForecastModel, string> = {
  naive: "Naive",
  moving_average: "Moving average",
  linear_trend: "Linear trend",
  seasonal_naive: "Seasonal naive",
};

function ForecastPage() {
  const { datasetId } = Route.useParams();
  const qc = useQueryClient();
  const getDs = useServerFn(getDataset);
  const getFc = useServerFn(getLatestForecast);
  const runFc = useServerFn(runDatasetForecast);

  const dsQ = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => getDs({ data: { datasetId } }),
  });
  const fcQ = useQuery({
    queryKey: ["forecast", datasetId],
    queryFn: () => getFc({ data: { datasetId } }),
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
  const last = fcQ.data;

  const [dateCol, setDateCol] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [granularity, setGranularity] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [aggregate, setAggregate] = useState<"mean" | "sum">("mean");

  const seedKey = `${columnProfiles.length}|${last?.id ?? ""}`;
  useMemoEffect(() => {
    if (last?.date_column) setDateCol(last.date_column);
    else if (candidates.suggestedDate) setDateCol(candidates.suggestedDate);
    if (last?.target_column) setTargetCol(last.target_column);
    else if (candidates.suggestedTarget) setTargetCol(candidates.suggestedTarget);
    if (last?.granularity) setGranularity(last.granularity);
    if (last?.horizon) setHorizon(last.horizon);
  }, seedKey);

  const runMut = useMutation({
    mutationFn: () =>
      runFc({
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
          horizon,
        },
      }),
    onSuccess: () => {
      toast.success("Forecast complete");
      qc.invalidateQueries({ queryKey: ["forecast", datasetId] });
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

  const params = (last?.parameters ?? {}) as {
    history?: TimePoint[];
    allModels?: ModelResult[];
  };
  const history: TimePoint[] = Array.isArray(params.history) ? params.history : [];
  const allModels: ModelResult[] = Array.isArray(params.allModels) ? params.allModels : [];
  const forecastPoints: ForecastPoint[] = Array.isArray(last?.forecast_points)
    ? (last!.forecast_points as unknown as ForecastPoint[])
    : [];
  const intervals: ConfidenceInterval[] = Array.isArray(last?.confidence_intervals)
    ? (last!.confidence_intervals as unknown as ConfidenceInterval[])
    : [];
  const trainRange = (last?.train_range ?? null) as unknown as TrainRange | null;
  const assumptions: string[] = Array.isArray(last?.assumptions)
    ? (last!.assumptions as unknown as string[])
    : [];
  const comparison = Array.isArray(last?.model_comparison)
    ? (last!.model_comparison as unknown as Array<{
        model: ForecastModel;
        mae: number | null;
        rmse: number | null;
        mape: number | null;
        holdoutSize: number;
        parameters: Record<string, number | string>;
      }>)
    : [];
  const metrics = (last?.metrics ?? {}) as {
    mae: number | null;
    rmse: number | null;
    mape: number | null;
    holdoutSize: number;
  };

  return (
    <AppShell
      title="Forecast"
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
          Dataset is not ready for forecasting. Current status:{" "}
          <span className="font-mono">{dataset.status}</span>
        </div>
      )}

      {ready && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-base font-semibold">Configure forecast</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All models are deterministic and reproducible. Holdout backtesting picks the best by
            RMSE.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-5">
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
            <Field label="Horizon (buckets)">
              <input
                className="select"
                type="number"
                min={1}
                max={120}
                value={horizon}
                onChange={(e) =>
                  setHorizon(Math.max(1, Math.min(120, Number(e.target.value) || 1)))
                }
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => runMut.mutate()}
              disabled={!dateCol || !targetCol || runMut.isPending || last?.status === "running"}
            >
              {runMut.isPending || last?.status === "running" ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Forecasting…
                </>
              ) : (
                <>
                  <Play className="mr-1 h-4 w-4" /> Run forecast
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
                Last run {new Date(last.created_at).toLocaleString()} · best:{" "}
                <span className="font-mono">
                  {MODEL_LABELS[last.model_name as ForecastModel] ?? last.model_name}
                </span>
              </span>
            )}
          </div>
        </section>
      )}

      {last?.status === "ready" && forecastPoints.length > 0 && (
        <div className="mt-6 space-y-6">
          <ForecastChartCard
            history={history}
            points={forecastPoints}
            intervals={intervals}
            targetColumn={last.target_column ?? ""}
            best={last.model_name as ForecastModel}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <MetricsCard
              metrics={metrics}
              bestModel={last.model_name as ForecastModel}
              horizon={last.horizon}
              granularity={last.granularity}
              trainRange={trainRange}
            />
            <AssumptionsCard assumptions={assumptions} />
          </div>

          <ComparisonCard
            comparison={comparison}
            best={last.model_name as ForecastModel}
            allModels={allModels}
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

function ForecastChartCard({
  history,
  points,
  intervals,
  targetColumn,
  best,
}: {
  history: TimePoint[];
  points: ForecastPoint[];
  intervals: ConfidenceInterval[];
  targetColumn: string;
  best: ForecastModel;
}) {
  const chartData = useMemo(() => {
    const lower = new Map(intervals.map((iv) => [iv.t, iv.lower]));
    const upper = new Map(intervals.map((iv) => [iv.t, iv.upper]));
    const hist = history.map((p) => ({ t: p.t, actual: p.v }));
    const fc = points.map((p) => ({
      t: p.t,
      yhat: p.yhat,
      band: [lower.get(p.t) ?? p.yhat, upper.get(p.t) ?? p.yhat] as [number, number],
    }));
    return [...hist, ...fc];
  }, [history, points, intervals]);

  return (
    <Card
      title={`Forecast — ${targetColumn || "value"}`}
      action={
        <span className="flex items-center gap-2 font-mono text-xs text-emerald">
          <TrendingUp className="h-4 w-4" /> {MODEL_LABELS[best]}
        </span>
      }
    >
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
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
            <Area
              type="monotone"
              dataKey="band"
              name="Confidence"
              stroke="none"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="hsl(var(--primary))"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="yhat"
              name="Forecast"
              stroke="hsl(var(--gold))"
              dot={false}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {history.length} historical · {points.length} forecast buckets · ~95% band from holdout
        residuals
      </p>
    </Card>
  );
}

function MetricsCard({
  metrics,
  bestModel,
  horizon,
  granularity,
  trainRange,
}: {
  metrics: { mae: number | null; rmse: number | null; mape: number | null; holdoutSize: number };
  bestModel: ForecastModel;
  horizon: number;
  granularity: string | null;
  trainRange: TrainRange | null;
}) {
  return (
    <Card
      title="Metrics & training"
      action={<span className="font-mono text-[10px] text-muted-foreground">holdout backtest</span>}
    >
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Metric k="MAE" v={fmtNum(metrics.mae)} />
        <Metric k="RMSE" v={fmtNum(metrics.rmse)} />
        <Metric k="MAPE" v={metrics.mape === null ? "—" : `${fmtNum(metrics.mape)}%`} />
      </dl>
      <hr className="my-4 border-border" />
      <dl className="space-y-1.5 font-mono text-xs">
        <Row k="Best model" v={MODEL_LABELS[bestModel] ?? bestModel} />
        <Row k="Horizon" v={`${horizon} ${granularity ?? "bucket"}${horizon === 1 ? "" : "s"}`} />
        <Row k="Holdout size" v={String(metrics.holdoutSize)} />
        <Row
          k="Train range"
          v={
            trainRange
              ? `${formatT(trainRange.start ?? "")} → ${formatT(trainRange.end ?? "")} (${trainRange.count})`
              : "—"
          }
        />
      </dl>
    </Card>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {k}
      </div>
      <div className="mt-1 font-display text-lg tabular-nums">{v}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function AssumptionsCard({ assumptions }: { assumptions: string[] }) {
  return (
    <Card title="Assumptions" action={<AlertCircle className="h-4 w-4 text-muted-foreground" />}>
      {assumptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assumptions recorded.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">·</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ComparisonCard({
  comparison,
  best,
  allModels,
}: {
  comparison: Array<{
    model: ForecastModel;
    mae: number | null;
    rmse: number | null;
    mape: number | null;
    holdoutSize: number;
    parameters: Record<string, number | string>;
  }>;
  best: ForecastModel;
  allModels: ModelResult[];
}) {
  return (
    <Card
      title="Model comparison"
      action={<span className="font-mono text-[10px] text-muted-foreground">ranked by RMSE</span>}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-2 py-2">Model</th>
              <th className="px-2 py-2">Parameters</th>
              <th className="px-2 py-2 text-right">MAE</th>
              <th className="px-2 py-2 text-right">RMSE</th>
              <th className="px-2 py-2 text-right">MAPE</th>
              <th className="px-2 py-2 text-right">Holdout</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((c) => (
              <tr key={c.model} className={c.model === best ? "bg-primary/5" : ""}>
                <td className="border-t border-border px-2 py-2 font-medium">
                  {MODEL_LABELS[c.model]}{" "}
                  {c.model === best && (
                    <span className="ml-1 rounded bg-emerald/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald">
                      BEST
                    </span>
                  )}
                </td>
                <td className="border-t border-border px-2 py-2 font-mono text-xs text-muted-foreground">
                  {Object.keys(c.parameters).length === 0
                    ? "—"
                    : Object.entries(c.parameters)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                </td>
                <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                  {fmtNum(c.mae)}
                </td>
                <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                  {fmtNum(c.rmse)}
                </td>
                <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                  {c.mape === null ? "—" : `${fmtNum(c.mape)}%`}
                </td>
                <td className="border-t border-border px-2 py-2 text-right font-mono tabular-nums">
                  {c.holdoutSize}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allModels.length > 0 && (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          {allModels.length} models compared on a holdout split of the training history.
        </p>
      )}
    </Card>
  );
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
