import { Activity } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Activity className="h-4 w-4" strokeWidth={2.5} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        TimeSeries<span className="gradient-gold-text">GPT</span>
      </span>
    </span>
  );
}
