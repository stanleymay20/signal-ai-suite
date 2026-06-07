import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import {
  Database,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createDataset, finalizeDataset, listDatasets } from "@/lib/datasets.functions";
import { HealthBadge } from "@/components/datasets/HealthBadge";

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — TimeSeriesGPT" }] }),
  component: DatasetsPage,
});

const MAX_BYTES = 50 * 1024 * 1024;
const fileSchema = z.object({
  workspaceId: z.string().uuid(),
  file: z
    .instanceof(File)
    .refine((f) => f.size > 0, "File is empty")
    .refine((f) => f.size <= MAX_BYTES, "File exceeds 50 MB limit")
    .refine((f) => /\.(csv|xlsx)$/i.test(f.name), "Only .csv and .xlsx are supported"),
});

function DatasetsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedWs, setSelectedWs] = useState<string>("");

  const create = useServerFn(createDataset);
  const finalize = useServerFn(finalizeDataset);
  const list = useServerFn(listDatasets);

  const wsQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dsQ = useQuery({
    queryKey: ["datasets", selectedWs || "_all"],
    enabled: !!wsQ.data,
    queryFn: async () => {
      if (!wsQ.data?.length) return [];
      const targets = selectedWs ? [selectedWs] : wsQ.data.map((w) => w.id);
      const wsMap = new Map(wsQ.data.map((w) => [w.id, w.name]));
      const results = await Promise.all(
        targets.map(async (id) => {
          const rows = await list({ data: { workspaceId: id } });
          return rows.map((r) => ({ ...r, workspace_id: id, workspace_name: wsMap.get(id) ?? "" }));
        }),
      );
      return results
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const uploadMut = useMutation({
    mutationFn: async (values: z.infer<typeof fileSchema>) => {
      const ext = values.file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
      const { datasetId, storagePath } = await create({
        data: {
          workspaceId: values.workspaceId,
          filename: values.file.name,
          fileType: ext,
          sizeBytes: values.file.size,
        },
      });
      const up = await supabase.storage.from("datasets").upload(storagePath, values.file, {
        cacheControl: "3600",
        upsert: false,
        contentType:
          ext === "csv"
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      if (up.error) throw new Error(up.error.message);
      await finalize({ data: { datasetId } });
      return datasetId;
    },
    onSuccess: (id) => {
      toast.success("Dataset profiled");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      router.navigate({ to: "/datasets/$datasetId", params: { datasetId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    const workspaceId = String(fd.get("workspaceId") ?? "");
    const parsed = fileSchema.safeParse({ workspaceId, file });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    uploadMut.mutate(parsed.data);
  }

  const hasWorkspaces = (wsQ.data?.length ?? 0) > 0;

  return (
    <AppShell
      title="Datasets"
      subtitle="Upload CSV or XLSX files. Schema and quality are inferred automatically."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!hasWorkspaces}>
              <Upload className="mr-1 h-4 w-4" /> Upload dataset
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload dataset</DialogTitle>
              <DialogDescription>
                CSV or XLSX, up to 50 MB. Stored privately in your workspace.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="workspaceId">Workspace</Label>
                <select
                  id="workspaceId"
                  name="workspaceId"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={wsQ.data?.[0]?.id ?? ""}
                >
                  {wsQ.data?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file">File</Label>
                <Input id="file" name="file" type="file" accept=".csv,.xlsx" required />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={uploadMut.isPending}>
                  {uploadMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploadMut.isPending ? "Uploading & profiling…" : "Upload"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {hasWorkspaces && (
        <div className="mb-5 flex max-w-xs items-center gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Workspace
          </Label>
          <Select
            value={selectedWs || "all"}
            onValueChange={(v) => setSelectedWs(v === "all" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {wsQ.data!.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasWorkspaces ? (
        <EmptyState />
      ) : dsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (dsQ.data?.length ?? 0) === 0 ? (
        <NoDatasets />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Dataset</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Cols</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {dsQ.data!.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to="/datasets/$datasetId"
                      params={{ datasetId: d.id }}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald" />
                      <span className="truncate">{d.filename}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {d.file_type}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {d.row_count?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{d.column_count ?? "—"}</td>
                  <td className="px-4 py-3">
                    <HealthBadge
                      score={
                        (Array.isArray(d.dataset_profiles)
                          ? d.dataset_profiles[0]?.quality_score
                          : d.dataset_profiles?.quality_score) ?? null
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    ready: {
      icon: CheckCircle2,
      cls: "text-emerald bg-emerald/10 border-emerald/30",
      label: "Ready",
    },
    profiling: {
      icon: Loader2,
      cls: "text-gold-foreground bg-gold/10 border-gold/30 animate-pulse",
      label: "Profiling",
    },
    uploading: {
      icon: Clock,
      cls: "text-muted-foreground bg-muted border-border",
      label: "Uploading",
    },
    failed: {
      icon: AlertCircle,
      cls: "text-destructive bg-destructive/10 border-destructive/30",
      label: "Failed",
    },
  } as const;
  const k = (status in map ? status : "uploading") as keyof typeof map;
  const { icon: Icon, cls, label } = map[k];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <Database className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-semibold">Create a workspace first</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Datasets belong to workspaces for tenant isolation.
      </p>
      <Link to="/workspaces" className="mt-4 inline-block">
        <Button>Go to workspaces</Button>
      </Link>
    </div>
  );
}

function NoDatasets() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
      <Database className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-xl font-semibold">No datasets yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a CSV or XLSX file to get started.
      </p>
    </div>
  );
}
