// Stand-ins for the Workers platform, shared by the worker's unit tests.

export const ORIGIN = 'https://craigthompson.dev';
export const WORKER = 'https://craga-ask.example.workers.dev';

/**
 * Anything with the bindings a test needs, as the worker's Env.
 * @param {Record<string, unknown>} [bindings]
 * @returns {Env}
 */
export const env = (bindings = {}) => /** @type {Env} */ (/** @type {unknown} */ (bindings));

/**
 * A Workers AI stand-in.
 * @param {(model: string, input: any) => unknown} run
 */
export const ai = (run) => ({ run: async (/** @type {string} */ model, /** @type {any} */ input) => run(model, input) });

/**
 * A POST from the site (or another origin) to one of the worker's endpoints.
 * @param {unknown} body
 * @param {{ origin?: string, method?: string, path?: string, headers?: Record<string, string> }} [opts]
 */
export const request = (body, { origin = ORIGIN, method = 'POST', path = '/ask', headers = {} } = {}) =>
  new Request(WORKER + path, {
    method,
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

/**
 * A D1 stand-in that records statements, and keeps the AI budget table (ai_budget) in memory.
 * @param {Record<string, number>} [spent] neurons already spent today, by share
 */
export function fakeDB(spent = {}) {
  /** @type {{ sql: string, args: unknown[] }[]} */
  const rows = [];
  /** @type {Record<string, number>} */
  const budget = { ...spent };
  return {
    rows,
    budget,
    /** @param {string} sql */
    prepare: (sql) => ({
      /** @param {...any} args */
      bind: (...args) => ({
        first: async () => (/FROM ai_budget/.test(sql) && args[1] in budget ? { neurons: budget[args[1]] } : null),
        run: async () => {
          if (/INTO ai_budget/.test(sql)) budget[args[1]] = (budget[args[1]] || 0) + args[2];
          else rows.push({ sql, args });
          return { success: true };
        },
      }),
    }),
  };
}

/** A rate limiter stand-in that always says yes, or always no. */
export const limiter = (/** @type {boolean} */ success) => ({ limit: async () => ({ success }) });
