import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  Loader2,
  User,
  Bot,
  FileBarChart,
  TrendingUp,
  Activity,
  Database,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getDataset } from "@/lib/datasets.functions";
import {
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendChatMessage,
} from "@/lib/conversations.functions";

export const Route = createFileRoute("/_authenticated/datasets_/$datasetId/chat")({
  head: () => ({ meta: [{ title: "Chat — SignalGPT" }] }),
  component: ChatPage,
});

type Citation = {
  source: "profile" | "analysis" | "forecast" | "anomaly";
  ref: string;
  detail?: Record<string, unknown>;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations_json: unknown;
  created_at: string;
};

function ChatPage() {
  const { datasetId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();

  const get = useServerFn(getDataset);
  const list = useServerFn(listConversations);
  const create = useServerFn(createConversation);
  const remove = useServerFn(deleteConversation);
  const getConv = useServerFn(getConversation);
  const send = useServerFn(sendChatMessage);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [followups, setFollowups] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const datasetQ = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => get({ data: { datasetId } }),
  });

  const conversationsQ = useQuery({
    queryKey: ["conversations", datasetId],
    queryFn: () => list({ data: { datasetId } }),
  });

  const activeConvQ = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => getConv({ data: { conversationId: activeId as string } }),
    enabled: !!activeId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          datasetId,
          workspaceId: datasetQ.data!.dataset.workspace_id,
          title: "New conversation",
        },
      }),
    onSuccess: (row) => {
      setActiveId(row.id);
      setFollowups([]);
      qc.invalidateQueries({ queryKey: ["conversations", datasetId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { conversationId: id } }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["conversations", datasetId] });
      if (activeId === id) setActiveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      send({ data: { conversationId: activeId as string, content } }),
    onSuccess: (res) => {
      setFollowups(res.followups ?? []);
      qc.invalidateQueries({ queryKey: ["conversation", activeId] });
      qc.invalidateQueries({ queryKey: ["conversations", datasetId] });
      inputRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Auto-select most recent or auto-create first conversation.
  useEffect(() => {
    if (activeId || !conversationsQ.data || !datasetQ.data) return;
    if (conversationsQ.data.length > 0) {
      setActiveId(conversationsQ.data[0].id);
    }
  }, [conversationsQ.data, datasetQ.data, activeId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeId]);

  const messages = (activeConvQ.data?.messages ?? []) as Message[];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMut.isPending) return;
    if (!activeId) {
      toast.error("Start a conversation first.");
      return;
    }
    setInput("");
    setFollowups([]);
    sendMut.mutate(text);
  }

  if (datasetQ.isLoading) {
    return (
      <AppShell title="Loading…">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </AppShell>
    );
  }
  if (!datasetQ.data) {
    return (
      <AppShell title="Dataset not found">
        <Link to="/datasets" className="text-sm text-primary hover:underline">
          ← Back to datasets
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Chat with your data"
      subtitle={datasetQ.data.dataset.filename}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/datasets/$datasetId" params={{ datasetId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
        </Button>
      }
    >
      <div className="grid h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[260px_1fr]">
        {/* Conversation list */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <Button
              size="sm"
              className="w-full"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              <MessageSquarePlus className="mr-1 h-4 w-4" /> New chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversationsQ.data?.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
            <ul className="space-y-1">
              {conversationsQ.data?.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      activeId === c.id
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this conversation?")) deleteMut.mutate(c.id);
                    }}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Chat panel */}
        <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          {!activeId ? (
            <EmptyState onCreate={() => createMut.mutate()} pending={createMut.isPending} />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6">
                {messages.length === 0 && (
                  <div className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">
                    <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
                    Ask anything grounded in this dataset's profile, analysis, forecast, or
                    anomalies.
                  </div>
                )}
                <div className="mx-auto max-w-3xl space-y-6">
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                  {sendMut.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking…
                    </div>
                  )}
                </div>
              </div>

              {followups.length > 0 && !sendMut.isPending && (
                <div className="border-t border-border px-4 py-2">
                  <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
                    {followups.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          setInput(f);
                          inputRef.current?.focus();
                        }}
                        className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={onSubmit} className="border-t border-border p-3">
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit(e);
                      }
                    }}
                    rows={2}
                    placeholder="Ask about trends, forecasts, anomalies…"
                    className="min-h-[44px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    disabled={sendMut.isPending}
                  />
                  <Button type="submit" size="sm" disabled={sendMut.isPending || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function EmptyState({ onCreate, pending }: { onCreate: () => void; pending: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <Sparkles className="h-8 w-8 text-primary" />
      <h2 className="font-display text-lg font-semibold">Start a conversation</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        SignalGPT explains the evidence already produced by your analysis, forecast, and anomaly
        runs — every answer comes with citations.
      </p>
      <Button size="sm" onClick={onCreate} disabled={pending}>
        <MessageSquarePlus className="mr-1 h-4 w-4" /> New chat
      </Button>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const citations = useMemo<Citation[]>(() => {
    const raw = message.citations_json;
    return Array.isArray(raw) ? (raw as Citation[]) : [];
  }, [message.citations_json]);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`min-w-0 flex-1 ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground"
          }`}
        >
          {message.content}
        </div>
        {!isUser && citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citations.map((c, i) => (
              <CitationChip key={i} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  const Icon =
    citation.source === "profile"
      ? Database
      : citation.source === "analysis"
        ? FileBarChart
        : citation.source === "forecast"
          ? TrendingUp
          : Activity;
  const label = citationLabel(citation);
  return (
    <span
      title={JSON.stringify(citation.detail ?? {}, null, 2)}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function citationLabel(c: Citation): string {
  const d = c.detail ?? {};
  switch (c.source) {
    case "profile":
      return `profile · quality ${d.qualityScore ?? "?"}`;
    case "analysis":
      return `analysis · trend ${d.trend ?? "?"}`;
    case "forecast":
      return `forecast · ${d.model ?? "?"} rmse=${d.rmse ?? "?"}`;
    case "anomaly":
      return d.timestamp ? `anomaly · ${d.timestamp}` : `anomalies · ${d.total ?? "?"}`;
  }
}
