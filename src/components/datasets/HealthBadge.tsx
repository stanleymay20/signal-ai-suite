export function HealthBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="font-mono text-xs text-muted-foreground">—</span>;
  }
  const tone =
    score >= 85 ? "text-emerald bg-emerald/10 border-emerald/30"
    : score >= 60 ? "text-gold-foreground bg-gold/10 border-gold/40"
    : "text-destructive bg-destructive/10 border-destructive/30";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${tone}`}>
      {score}
      <span className="ml-0.5 text-[10px] opacity-70">/100</span>
    </span>
  );
}
