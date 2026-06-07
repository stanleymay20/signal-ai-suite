import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Users, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/workspaces/$workspaceId")({
  head: () => ({ meta: [{ title: "Workspace — Signal AI Suite" }] }),
  component: WorkspaceDetail,
});

function WorkspaceDetail() {
  const { workspaceId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();

  const wsQ = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, description, owner_id, created_at")
        .eq("id", workspaceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const membersQ = useQuery({
    queryKey: ["workspace_members", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        action: "workspace.deleted",
        metadata: { workspace_id: workspaceId },
      });
    },
    onSuccess: () => {
      toast.success("Workspace deleted");
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      router.navigate({ to: "/workspaces" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwner = wsQ.data?.owner_id === user.id;

  return (
    <AppShell
      title={wsQ.data?.name ?? "Workspace"}
      subtitle={wsQ.data?.description ?? undefined}
      actions={
        <Link to="/workspaces">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> All workspaces
          </Button>
        </Link>
      }
    >
      {wsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !wsQ.data ? (
        <p className="text-sm text-muted-foreground">Workspace not found.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Overview</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Created">{new Date(wsQ.data.created_at).toLocaleString()}</Field>
                <Field label="Role">{isOwner ? "Owner" : "Member"}</Field>
                <Field label="Workspace ID">
                  <span className="font-mono text-xs">{wsQ.data.id}</span>
                </Field>
              </dl>
            </section>

            <section className="rounded-xl border border-dashed border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">Datasets</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Phase 2 will land here: CSV / Excel / TSV upload, schema detection, and dataset
                health scoring.
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Members</h2>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-4 space-y-2">
                {membersQ.data?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-gold" />}
                      <span className="truncate font-mono text-xs">
                        {m.user_id === user.id ? "You" : m.user_id.slice(0, 8) + "…"}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Member invitation by email arrives in Phase 2.
              </p>
            </section>

            {isOwner && (
              <section className="rounded-xl border border-destructive/40 bg-card p-6">
                <h2 className="font-display text-lg font-semibold text-destructive">Danger zone</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Deleting a workspace removes all of its datasets, analyses, and conversations.
                  This cannot be undone.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="mt-4">
                      <Trash2 className="mr-1 h-4 w-4" /> Delete workspace
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes "{wsQ.data.name}". Confirm to continue.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          deleteMut.mutate();
                        }}
                      >
                        {deleteMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
