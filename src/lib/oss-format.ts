// How the open-source counts are written, on the page as built and when live.json refreshes them.

export const fmt = (n: number) => n.toLocaleString('en-GB');
/** qTip2's stars, rounded the way the page shows them: ~2k. */
export const stars = (n: number) => (n >= 1000 ? `~${Math.round(n / 1000)}k` : String(n));

/** Heatmap shade for a quarter's count, 0 (none) to 4. */
export const level = (n: number) => (!n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
