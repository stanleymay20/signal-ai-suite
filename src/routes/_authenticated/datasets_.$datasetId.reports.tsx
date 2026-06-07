import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, FileText, Download, Trash2, Loader2, Sparkles, FilePlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  deleteReport,
  exportReportPdf,
  exportReportPptx,
  generateReport,
  getReport,
  listReports,
} from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId/reports")({
  head: () => ({ meta: [{ title: "Reports — SignalGPT" }] }),
  component: ReportsPage,
});

const REPORT_TYPES = [
  { value: "executive_summary", label: "Executive Summary" },
  { value: "boardroom", label: "Boardroom Report" },
  { value: "risk_brief", label: "Risk Brief" },
  { value: "forecast_brief", label: "Forecast Brief" },
  { value: "anomaly_investigation", label: "Anomaly Investigation" },
] as const;
type ReportTypeValue = (typeof REPORT_TYPES)[number]["value"];

type ReportListRow = {
  id: string;
  type: ReportTypeValue;
  title: string;
  risk_score: { score: number; level: string } | null;
  ai_model: string | null;
  ai_provider: string | null;
  created_at: string;
};

type Section =
  | { type: "kpis"; heading: string; kpis: Array<{ label: string; value: string; hint?: string }> }
  | { type: "table"; heading: string; columns: string[]; rows: string[][] }
  | { type: "bullets"; heading: string; items: string[] }
  | { type: "narrative"; heading: string; slot: string; prompt: string; text?: string };

type ReportDetail = {
  id: string;
  type: ReportTypeValue;
  title: string;
  sections: Section[];
  citations: Array<{ source: string; ref: string; detail?: Record<string, unknown> }>;
  risk_score: { score: number; level: string; drivers: string[] };
  ai_model: string | null;
  ai_provider: string | null;
  created_at: string;
};

function downloadSigned(filename: string, signedUrl: string) {
  // Open the signed URL — Storage forces a download via the response
  // Content-Disposition header (we pass download=filename when signing).
  const a = document.createElement("a");
  a.href = signedUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ReportsPage() {
  const { datasetId } = Route.useParams();
  const qc = useQueryClient();
  const list = useServerFn(listReports);
  const get = useServerFn(getReport);
  const gen = useServerFn(generateReport);
  const del = useServerFn(deleteReport);
  const pdf = useServerFn(exportReportPdf);
  const pptx = useServerFn(exportReportPptx);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<ReportTypeValue | null>(null);

  const reportsQ = useQuery({
    queryKey: ["reports", datasetId],
    queryFn: () => list({ data: { datasetId } }),
  });

  const reports = (reportsQ.data ?? []) as ReportListRow[];
  const activeId = selectedId ?? reports[0]?.id ?? null;

  const detailQ = useQuery({
    queryKey: ["report", activeId],
    queryFn: () => get({ data: { reportId: activeId! } }),
    enabled: !!activeId,
  });
  const detail = detailQ.data as ReportDetail | undefined;

  const genMut = useMutation({
    mutationFn: (type: ReportTypeValue) => gen({ data: { datasetId, type } }),
    onSuccess: ({ report }) => {
      toast.success("Report generated");
      setSelectedId(report.id);
      qc.invalidateQueries({ queryKey: ["reports", datasetId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingType(null),
  });

  const delMut = useMutation({
    mutationFn: (reportId: string) => del({ data: { reportId } }),
    onSuccess: () => {
      toast.success("Report deleted");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["reports", datasetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pdfMut = useMutation({
    mutationFn: (reportId: string) => pdf({ data: { reportId } }),
    onSuccess: (r) => downloadSigned(r.filename, r.signedUrl),
    onError: (e: Error) => toast.error(e.message),
  });
  const pptxMut = useMutation({
    mutationFn: (reportId: string) => pptx({ data: { reportId } }),
    onSuccess: (r) => downloadSigned(r.filename, r.signedUrl),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Reports"
      subtitle="Hybrid deterministic + AI-narrated briefs grounded in the dataset's evidence package"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/datasets/$datasetId" params={{ datasetId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Dataset
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Generate
            </p>
            <div className="space-y-1.5">
              {REPORT_TYPES.map((t) => (
                <Button
                  key={t.value}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  disabled={genMut.isPending}
                  onClick={() => {
                    setPendingType(t.value);
                    genMut.mutate(t.value);
                  }}
                >
                  {genMut.isPending && pendingType === t.value ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FilePlus className="mr-2 h-3.5 w-3.5" />
                  )}
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <p className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              History
            </p>
            {reportsQ.isLoading ? (
              <div className="p-4 text-xs text-muted-foreground">
                <Loader2 className="inline h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : reports.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No reports yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {reports.map((r) => (
                  <li key={r.id}>
                    <button
                      className={`w-full px-4 py-3 text-left text-xs transition hover:bg-muted/40 ${
                        activeId === r.id ? "bg-muted/60" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <p className="truncate font-medium text-foreground">{r.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                      {r.risk_score && (
                        <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                          risk {r.risk_score.score}/100 · {r.risk_score.level}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-border bg-card">
          {!activeId ? (
            <EmptyState />
          ) : detailQ.isLoading || !detail ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : (
            <ReportView
              detail={detail}
              onPdf={() => pdfMut.mutate(detail.id)}
              onPptx={() => pptxMut.mutate(detail.id)}
              onDelete={() => {
                if (confirm("Delete this report?")) delMut.mutate(detail.id);
              }}
              pdfBusy={pdfMut.isPending}
              pptxBusy={pptxMut.isPending}
              delBusy={delMut.isPending}
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <FileText className="h-8 w-8 text-muted-foreground" />
      <p className="font-display text-lg font-semibold">No report selected</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Pick a report type on the left to generate an evidence-grounded brief. KPIs, tables, risk
        scores, and citations are deterministic. Narrative sections are filled by the AI layer using
        only the cited evidence.
      </p>
    </div>
  );
}

function ReportView({
  detail,
  onPdf,
  onPptx,
  onDelete,
  pdfBusy,
  pptxBusy,
  delBusy,
}: {
  detail: ReportDetail;
  onPdf: () => void;
  onPptx: () => void;
  onDelete: () => void;
  pdfBusy: boolean;
  pptxBusy: boolean;
  delBusy: boolean;
}) {
  return (
    <div className="divide-y divide-border">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold">{detail.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {new Date(detail.created_at).toLocaleString()} ·{" "}
            <span className="font-mono">
              risk {detail.risk_score?.score ?? 0}/100 · {detail.risk_score?.level}
            </span>
            {detail.ai_provider && (
              <>
                {" · "}
                <Sparkles className="inline h-3 w-3" /> {detail.ai_provider}/{detail.ai_model}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={pdfBusy} onClick={onPdf}>
            {pdfBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            PDF
          </Button>
          <Button variant="outline" size="sm" disabled={pptxBusy} onClick={onPptx}>
            {pptxBusy ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1 h-3.5 w-3.5" />
            )}
            PPTX
          </Button>
          <Button variant="destructive" size="sm" disabled={delBusy} onClick={onDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </header>

      <div className="space-y-6 p-5">
        {detail.sections.map((s, i) => (
          <SectionRenderer key={i} s={s} />
        ))}
      </div>

      {detail.citations.length > 0 && (
        <div className="p-5">
          <h3 className="mb-2 font-display text-sm font-semibold">Citations</h3>
          <ul className="space-y-1 text-xs font-mono text-muted-foreground">
            {detail.citations.map((c, i) => (
              <li key={i}>
                [{c.source}] {c.ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-5 py-4 text-[10px] italic text-muted-foreground">
        Generated from Signal AI Suite evidence package. All metrics, forecasts, anomalies, and
        citations are derived from deterministic analysis outputs. AI-generated narrative sections
        are grounded exclusively in cited evidence available at generation time.
      </p>
    </div>
  );
}

function SectionRenderer({ s }: { s: Section }) {
  return (
    <section>
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {s.heading}
      </h3>
      {s.type === "kpis" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {s.kpis.map((k, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {k.label}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{k.value}</p>
              {k.hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{k.hint}</p>}
            </div>
          ))}
        </div>
      )}
      {s.type === "table" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {s.columns.map((c) => (
                  <th key={c} className="px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 font-mono tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {s.type === "bullets" && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {s.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {s.type === "narrative" && (
        <p className="text-sm leading-relaxed text-foreground">
          {s.text && s.text.length > 0 ? s.text : "(No narrative generated.)"}
        </p>
      )}
    </section>
  );
}
