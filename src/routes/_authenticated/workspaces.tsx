import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, FolderKanban, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — TimeSeriesGPT" }] }),
  component: WorkspacesPage,
});

const wsSchema = z.object({
  name: z.string().min(2, "Name must be 2+ characters").max(80),
  description: z.string().max(400).optional(),
});

function WorkspacesPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const wsQ = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, description, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (values: z.infer<typeof wsSchema>) => {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({
          owner_id: user.id,
          name: values.name,
          description: values.description ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Add self as owner-member
      const { error: mErr } = await supabase.from("workspace_members").insert({
        workspace_id: data.id,
        user_id: user.id,
        role: "owner",
      });
      if (mErr) throw mErr;

      // Audit
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "workspace.created",
        metadata: { workspace_id: data.id, name: values.name },
      });

      return data;
    },
    onSuccess: () => {
      toast.success("Workspace created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = wsSchema.safeParse({
      name: fd.get("name"),
      description: fd.get("description") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    createMut.mutate(parsed.data);
  }

  return (
    <AppShell
      title="Workspaces"
      subtitle="Each workspace is an isolated tenant for datasets, analyses, and conversations."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>
                You become the owner. RLS keeps data isolated to its members.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required maxLength={80} placeholder="Acme Revenue Ops" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" name="description" maxLength={400} rows={3} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {wsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : wsQ.data?.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-semibold">No workspaces yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one to start uploading datasets.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wsQ.data?.map((w) => (
            <Link
              key={w.id}
              to="/workspaces/$workspaceId"
              params={{ workspaceId: w.id }}
              className="group rounded-xl border border-border bg-card p-5 transition hover:border-emerald/60 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FolderKanban className="h-5 w-5" />
                </div>
                {w.owner_id === user.id && (
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gold-foreground">
                    Owner
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{w.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {w.description || "No description."}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">
                  {new Date(w.created_at).toLocaleDateString()}
                </span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
