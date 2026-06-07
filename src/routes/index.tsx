import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Brain,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TimeSeriesGPT — Conversational Time-Series Intelligence" },
      {
        name: "description",
        content:
          "Upload a CSV. Ask anything. TimeSeriesGPT forecasts, detects anomalies, and explains trends with grounded, auditable AI.",
      },
      { property: "og:title", content: "TimeSeriesGPT — Conversational Time-Series Intelligence" },
      {
        property: "og:description",
        content:
          "Explainable forecasts, anomaly detection, and boardroom reports from a single conversation.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Brain,
    title: "Ask in natural language",
    body: "Why did revenue spike in March? Forecast EMEA next quarter. TimeSeriesGPT answers — grounded in your data.",
  },
  {
    icon: TrendingUp,
    title: "Explainable forecasts",
    body: "Prophet, ARIMA, SARIMA, XGBoost. Every prediction ships with confidence intervals, model rationale, and assumptions.",
  },
  {
    icon: Sparkles,
    title: "Anomaly intelligence",
    body: "Isolation Forest, Z-score, IQR, seasonal decomposition — with impact assessment and plain-English explanations.",
  },
  {
    icon: BarChart3,
    title: "Executive reports",
    body: "One click to a boardroom-ready PDF or PPTX with charts, KPIs, forecasts, anomalies and recommendations.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise hardened",
    body: "Multi-tenant, role-based access, row-level security and an auditable trail of every model run.",
  },
  {
    icon: Workflow,
    title: "Local LLM ready",
    body: "Plug in Ollama, vLLM, OpenAI-compatible endpoints — Qwen, DeepSeek, Llama. Never leak data to a vendor.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition hover:text-foreground">
              How it works
            </a>
            <a href="#stack" className="transition hover:text-foreground">
              Stack
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-terminal opacity-50" aria-hidden />
        <div
          className="absolute inset-x-0 -top-32 mx-auto h-72 max-w-3xl rounded-full bg-emerald/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald" />
              SignalGPT · v1 · Phase 1 Foundation
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Talk to your <span className="gradient-gold-text">time series.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              TimeSeriesGPT is ChatGPT for analysts. Upload a dataset, ask anything, and get
              explainable forecasts, anomaly detection, and executive briefings — with every number
              traceable to source.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="h-12 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
                >
                  Launch the terminal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="h-12 px-6">
                  See capabilities
                </Button>
              </a>
            </div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Prophet · ARIMA · SARIMA · XGBoost · Isolation Forest · Ollama-ready
            </p>
          </div>

          {/* Terminal mock */}
          <div className="mx-auto mt-16 max-w-4xl rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                signal:// retail_sales_2024.csv
              </span>
              <span className="font-mono text-xs text-emerald">● live</span>
            </div>
            <div className="space-y-4 p-6 font-mono text-sm">
              <p className="text-muted-foreground">
                <span className="text-gold">analyst@signal</span> ~ ask
              </p>
              <p>&gt; Forecast Q4 revenue and explain seasonality drivers.</p>
              <div className="rounded-md border border-emerald/30 bg-emerald/5 p-4 text-sm">
                <p className="text-emerald">▍ Prophet (selected · MAPE 4.2%)</p>
                <p className="mt-2 text-foreground/90">
                  Q4 revenue projected at <span className="font-semibold">$48.2M ± $2.1M</span> (95%
                  CI). Seasonality dominated by a Black-Friday spike (+38% baseline) and a
                  mid-December plateau. Three anomalies flagged in Sep — likely promo-driven.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-surface/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald">Capabilities</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">
              An analytics desk that thinks alongside you.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built on the principle that every prediction must be explainable, every answer
              grounded, and every model swappable.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="group rounded-xl border border-border bg-card p-6 transition hover:border-emerald/60 hover:shadow-lg"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-emerald">Workflow</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight">
                From CSV to boardroom brief in minutes.
              </h2>
              <p className="mt-4 text-muted-foreground">
                One operator. One conversation. Audit-ready output every step of the way.
              </p>
            </div>
            <ol className="space-y-6">
              {[
                [
                  "Upload",
                  "Drop a CSV, Excel or TSV. We profile schema, types, nulls and duplicates.",
                ],
                [
                  "Explore",
                  "Auto-generated trend, seasonality and correlation charts with an executive summary.",
                ],
                [
                  "Forecast",
                  "Prophet, ARIMA, SARIMA, ES, XGBoost — we recommend the winner and explain why.",
                ],
                ["Decide", "Ask follow-ups in chat. Export a PDF brief, share with the board."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gold font-mono text-sm font-semibold text-gold-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section
        id="stack"
        className="border-t border-border bg-primary py-24 text-primary-foreground"
      >
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-gold">
            Bring your own LLM
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight">
            No vendor lock-in. Ever.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-primary-foreground/70">
            TimeSeriesGPT speaks Ollama, vLLM, OpenAI-compatible APIs, Qwen, DeepSeek and Llama. Run
            fully local for regulated industries.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-2 font-mono text-xs">
            {["Ollama", "vLLM", "OpenAI-compatible", "Qwen", "DeepSeek", "Llama", "Lovable AI"].map(
              (p) => (
                <span
                  key={p}
                  className="rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-primary-foreground/90"
                >
                  {p}
                </span>
              ),
            )}
          </div>
          <div className="mt-10">
            <Link to="/auth">
              <Button size="lg" className="h-12 bg-gold px-8 text-gold-foreground hover:bg-gold/90">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <p className="font-mono text-xs">
            © {new Date().getFullYear()} TimeSeriesGPT · SignalGPT
          </p>
        </div>
      </footer>
    </div>
  );
}
