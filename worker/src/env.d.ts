// The Cloudflare Workers platform, as far as this worker uses it (bindings are declared in
// wrangler.toml). Written out here rather than depending on @cloudflare/workers-types.

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
interface Ai {
  run(model: string, input: Record<string, unknown>): Promise<any>;
}

/** The worker's bindings and variables (worker/wrangler.toml). */
interface Env {
  AI: Ai;
  DB?: D1Database;
  ASK_LIMITER?: RateLimit;
  SPEAK_LIMITER?: RateLimit;
  HIT_LIMITER?: RateLimit;
  MCP_LIMITER?: RateLimit;
  SITE_URL?: string;
  /** Per-share daily caps, overriding budget.js's CAPS (AI_CAP_ASK etc.). */
  [cap: `AI_CAP_${string}`]: string | undefined;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Request {
  /** Cloudflare's request metadata. */
  readonly cf?: { country?: string };
}
interface RequestInit {
  /** Cloudflare's per-request cache settings. */
  cf?: { cacheTtl?: number; cacheEverything?: boolean };
}
