// Open-source counts: the snapshot the weekly stats job commits to the oss branch
// (reports/oss.json). Pages show it as built; scripts/live.ts refreshes it from live.json.
import { execFileSync } from 'node:child_process';

export interface Quarter {
  y: number;
  q: number;
  n: number;
  repos: string[];
}
export interface OssSnapshot {
  at: string;
  prs: number;
  repos: number;
  since: number;
  qtip: { stars: number; forks: number; commits: number };
  timeline: Quarter[];
}

let cached: OssSnapshot | null | undefined;

/** The snapshot, or null when the oss branch isn't available (a shallow local clone, say). */
export function ossSnapshot(): OssSnapshot | null {
  if (cached !== undefined) return cached;
  try {
    const json = execFileSync('git', ['show', 'origin/oss:reports/oss.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const d = JSON.parse(json) as OssSnapshot;
    cached = Array.isArray(d.timeline) ? d : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** The counts used in the text when there's no snapshot. */
export const FALLBACK = { prs: 59, repos: 35, since: 2012, qtip: { stars: 1970, forks: 458, commits: 1384 } };

export const fmt = (n: number) => n.toLocaleString('en-GB');
/** qTip2's stars, rounded the way the page shows them: ~2k. */
export const stars = (n: number) => (n >= 1000 ? `~${Math.round(n / 1000)}k` : String(n));

/** Heatmap shade for a quarter's count, 0 (none) to 4. */
export const level = (n: number) => (!n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
