import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  LineChart as LineChartIcon,
  TrendingUp,
  Activity,
  MessageSquare,
  FileText,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { HealthBadge } from "@/components/datasets/HealthBadge";
import { getDataset, getDatasetSignedUrl, deleteDataset } from "@/lib/datasets.functions";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId")({
  head: () => ({ meta: [{ title: "Dataset — Signal AI Suite" }] }),
  component: DatasetDetail,
});

type Issue = {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  column?: string;
};
type Summary = {
  rowCount: number;
  columnCount: number;
  duplicateRowPercentage: number;
  missingCellPercentage: number;
  numericColumns: number;
  categoricalColumns: number;
  dateColumns: number;
};

function DatasetDetail() {
  const { datasetId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const get = useServerFn(getDataset);
  const sign = useServerFn(getDatasetSignedUrl);
  const del = useServerFn(deleteDataset);

  const q = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => get({ data: { datasetId } }),
    refetchInterval: (data) => {
      const status = data.state.data?.dataset.status;
      return status === "uploading" || status === "profiling" ? 1500 : false;
    },
  });

  const downloadMut = useMutation({
    mutationFn: () => sign({ data: { datasetId } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => del({ data: { datasetId } }),
    onSuccess: () => {
      toast.success("Dataset deleted");
      qc.invalidateQueries({ queryKey: ["datasets"] });
      router.navigate({ to: "/datasets" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <AppShell title="Loading dataset…">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </AppShell>
    );
  }
  if (q.isError || !q.data) {
    return (
      <AppShell title="Dataset not found">
        <Link to="/datasets" className="text-sm text-primary hover:underline">
          ← Back to datasets
        </Link>
      </AppShell>
    );
  }

  const { dataset, columns, profile } = q.data;
  const summary = (profile?.summary_json ?? null) as Summary | null;
  const issues = (profile?.issues_json ?? []) as Issue[];

  return (
    <AppShell
      title={dataset.filename}
      subtitle={`${dataset.file_type.toUpperCase()} · uploaded ${new Date(dataset.created_at).toLocaleString()}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/datasets">
              <ArrowLeft className="mr-1 h-4 w-4" /> Datasets
            </Link>
          </Button>
          {dataset.status === "ready" && (
            <>
              <Button variant="default" size="sm" asChild>
                <Link to="/datasets/$datasetId/analysis" params={{ datasetId }}>
                  <LineChartIcon className="mr-1 h-4 w-4" /> Analyze
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/datasets/$datasetId/forecast" params={{ datasetId }}>
                  <TrendingUp className="mr-1 h-4 w-4" /> Forecast
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/datasets/$datasetId/anomalies" params={{ datasetId }}>
                  <Activity className="mr-1 h-4 w-4" /> Anomalies
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/datasets/$datasetId/chat" params={{ datasetId }}>
                  <MessageSquare className="mr-1 h-4 w-4" /> Chat
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/datasets/$datasetId/reports" params={{ datasetId }}>
                  <FileText className="mr-1 h-4 w-4" /> Reports
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={downloadMut.isPending}
            onClick={() => downloadMut.mutate()}
          >
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteMut.isPending}
            onClick={() => {
              if (confirm("Delete this dataset and its file?")) deleteMut.mutate();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      }
    >
      {dataset.status === "failed" && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Profiling failed</p>
            <p className="mt-0.5 text-muted-foreground">
              {dataset.error_message ?? "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {(dataset.status === "uploading" || dataset.status === "profiling") && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>{dataset.status === "uploading" ? "Uploading file…" : "Profiling dataset…"}</span>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Rows" value={summary.rowCount.toLocaleString()} />
          <Stat label="Columns" value={String(summary.columnCount)} />
          <Stat label="Missing cells" value={`${summary.missingCellPercentage}%`} />
          <Stat label="Duplicate rows" value={`${summary.duplicateRowPercentage}%`} />
        </div>
      )}

      {profile && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-display text-base font-semibold">Schema & column profile</h2>
              <span className="font-mono text-xs text-muted-foreground">
                {columns.length} columns
              </span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Column</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Missing %</th>
                    <th className="px-4 py-2">Unique</th>
                    <th className="px-4 py-2">Range / Top</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((c) => {
                    const stats = (c.stats ?? {}) as Record<string, unknown>;
                    return (
                      <tr key={c.id} className="border-t border-border align-top">
                        <td className="px-4 py-3 font-medium">{c.column_name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                            {c.data_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {c.missing_percentage ?? 0}%
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {c.unique_ratio !== null
                            ? `${(Number(c.unique_ratio) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <ColumnStatPreview stats={stats} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Health score
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold tabular-nums">
                  {profile.quality_score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-3">
                <HealthBadge score={profile.quality_score} />
              </div>
              {summary && (
                <dl className="mt-5 space-y-1.5 text-xs text-muted-foreground">
                  <Row k="Numeric columns" v={String(summary.numericColumns)} />
                  <Row k="Categorical columns" v={String(summary.categoricalColumns)} />
                  <Row k="Date columns" v={String(summary.dateColumns)} />
                </dl>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card">
              <header className="border-b border-border px-5 py-3">
                <h3 className="font-display text-sm font-semibold">Detected issues</h3>
              </header>
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 px-5 py-4 text-sm text-emerald">
                  <CheckCircle2 className="h-4 w-4" /> No issues detected.
                </div>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {issues.map((i, idx) => (
                    <IssueItem key={idx} issue={i} />
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd className="font-mono tabular-nums text-foreground">{v}</dd>
    </div>
  );
}

function ColumnStatPreview({ stats }: { stats: Record<string, unknown> }) {
  const min = stats.min,
    max = stats.max,
    mean = stats.mean;
  const top = stats.topValues as Array<{ value: string; count: number }> | undefined;
  if (typeof mean === "number") {
    return (
      <span className="font-mono">
        min {Number(min).toLocaleString()} · max {Number(max).toLocaleString()} · μ{" "}
        {Number(mean).toFixed(2)}
      </span>
    );
  }
  if (typeof min === "string" && typeof max === "string") {
    return (
      <span className="font-mono">
        {min.slice(0, 10)} → {max.slice(0, 10)}
      </span>
    );
  }
  if (top && top.length) {
    return (
      <span>
        {top
          .slice(0, 3)
          .map((t) => `${t.value} (${t.count})`)
          .join(", ")}
      </span>
    );
  }
  return <span>—</span>;
}

function IssueItem({ issue }: { issue: Issue }) {
  const Icon =
    issue.severity === "critical"
      ? AlertTriangle
      : issue.severity === "warning"
        ? AlertCircle
        : Info;
  const tone =
    issue.severity === "critical"
      ? "text-destructive"
      : issue.severity === "warning"
        ? "text-gold-foreground"
        : "text-muted-foreground";
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <Icon className={`mt-0.5 h-4 w-4 ${tone}`} />
      <div className="min-w-0">
        <p className="text-foreground">{issue.message}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {issue.code}
          {issue.column ? ` · ${issue.column}` : ""}
        </p>
      </div>
    </li>
  );
}
