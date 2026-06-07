import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Signal AI Suite" },
      {
        name: "description",
        content: "Sign in to Signal AI Suite to analyze and forecast your time-series data.",
      },
    ],
  }),
  component: AuthPage,
});

const credSchema = z.object({
  email: z.string().email("Enter a valid email").max(254),
  password: z.string().min(8, "At least 8 characters").max(72),
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // If already signed in, send to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard",
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      router.navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  }

  async function handleEmail(e: React.FormEvent<HTMLFormElement>, mode: "signin" | "signup") {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = credSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const fullName = String(form.get("full_name") ?? "").trim();
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: fullName || parsed.data.email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
      router.navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Marketing pane */}
      <div className="relative hidden flex-col justify-between gradient-navy p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 grid-terminal opacity-20" aria-hidden />
        <div className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/80 transition hover:text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <div className="mt-12">
            <Logo />
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            The analytics desk that <span className="gradient-gold-text">explains itself.</span>
          </h2>
          <p className="max-w-md text-sm text-primary-foreground/70">
            Sign in to upload data, forecast revenue, hunt anomalies, and ship boardroom briefings —
            grounded in your own numbers.
          </p>
          <div className="rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 p-4 font-mono text-xs text-primary-foreground/80">
            <p className="text-gold">▍ Why teams pick Signal AI Suite</p>
            <ul className="mt-3 space-y-1.5">
              <li>· Explainable forecasts with confidence intervals</li>
              <li>· Multi-tenant workspaces, RLS by default</li>
              <li>· Local LLM ready — Ollama, vLLM, Qwen, Llama</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Auth pane */}
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your Signal AI Suite workspace.
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-6 h-11 w-full"
            disabled={loading}
            onClick={handleGoogle}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono uppercase tracking-widest">or email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={(e) => handleEmail(e, "signin")} className="space-y-4">
                <Field
                  id="email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <Field
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={(e) => handleEmail(e, "signup")} className="space-y-4">
                <Field id="full_name" name="full_name" label="Full name" autoComplete="name" />
                <Field
                  id="email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                />
                <Field
                  id="password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  required
                  hint="At least 8 characters."
                />
                <Button type="submit" className="h-11 w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing you agree to operate on your own data, audited end-to-end.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  required,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} autoComplete={autoComplete} required={required} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden {...props}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29 35.4 26.6 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.2C40.7 36 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
