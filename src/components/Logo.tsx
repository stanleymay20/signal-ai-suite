/**
 * Signal AI Suite brand mark.
 *
 * Two variants:
 *   - <Logo />          icon mark + wordmark + tagline (use on auth/landing/headers)
 *   - <Logo iconOnly /> icon mark + compact wordmark   (use in sidebars / tight chrome)
 */

import logoIcon from "/brand/logo-icon.png?url";

export function Logo({
  className = "",
  iconOnly = false,
  showTagline = false,
}: {
  className?: string;
  iconOnly?: boolean;
  showTagline?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img
        src={logoIcon}
        alt="Signal AI Suite logo"
        width={iconOnly ? 32 : 40}
        height={iconOnly ? 32 : 40}
        className={iconOnly ? "h-8 w-8" : "h-10 w-10"}
      />
      <span className="flex flex-col leading-tight">
        <span
          className={`font-display font-semibold tracking-tight ${iconOnly ? "text-base" : "text-lg"}`}
        >
          Signal <span className="gradient-gold-text">AI</span> Suite
        </span>
        {showTagline && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Turning Data Into Decisions
          </span>
        )}
      </span>
    </span>
  );
}
