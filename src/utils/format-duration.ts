// Human-readable durations for the issue detail view ("in <state> for: 3d 4h").
// Compact, at most two units (the largest two that apply), so the line stays
// short in the meta block. Wall-clock based; the caller computes the span.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// humanizeDuration renders a millisecond span as a compact "Nd Nh" / "Nh Nm" /
// "Nm" string, showing the two largest non-zero units. Spans under a minute read
// as "just now" so the line never shows "0m" for a fresh transition.
export function humanizeDuration(ms: number): string {
  if (ms < MINUTE_MS) return "just now";

  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  // Minutes only matter below the day scale; once we are counting days, the
  // minute remainder is noise, so cap the output at the two largest units.
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);

  return parts.slice(0, 2).join(" ");
}
