// A daily budget for Workers AI, so the site's AI features never cost anything.
//
// Workers AI includes 10,000 free "neurons" a day (reset at 00:00 UTC). On the Workers Free plan,
// going over simply makes requests fail; on Workers Paid it's billed. Either way this keeps usage
// inside the free allowance, and splits it so one feature can't use up another's share:
//   ask    ask.sh answers for visitors (site, WebMCP and MCP)   ~40 neurons each
//   speak  reading answers aloud in the natural voice            ~2.7 neurons per character
//   test   CI smoke tests and answer tests (x-craga-test)
// When a share is used up, that feature falls back (search answers, the browser's own voice).
// Spending is recorded per UTC day in D1 (table ai_budget). If D1 can't be read, AI is off.

import { errorMessage } from '../../shared/errors.js';

// Neurons per share per day; together under the 10,000 free, with headroom.
/** @typedef {'ask' | 'speak' | 'test'} Share */
/** @type {Record<Share, number>} */
export const CAPS = { ask: 6000, speak: 2500, test: 1000 };

// Workers AI rates, in neurons (developers.cloudflare.com/workers-ai/platform/pricing).
/** @type {Record<string, [number, number]>} */
const TEXT = {
  '@cf/google/gemma-4-26b-a4b-it': [9091, 27273],
  '@cf/qwen/qwen3-30b-a3b-fp8': [4625, 30475],
  '@cf/meta/llama-3.1-8b-instruct-fp8-fast': [4119, 34868],
};
/** @type {Record<string, (chars: number) => number>} */
const VOICE = {
  '@cf/deepgram/aura-2-en': (chars) => (chars / 1000) * 2727.27,
  '@cf/deepgram/aura-1': (chars) => (chars / 1000) * 1363.64,
  // Priced per audio minute; English speech runs at roughly 15 characters a second.
  '@cf/myshell-ai/melotts': (chars) => (chars / 900) * 18.63,
};

// Neurons for one text-generation call: from the model's reported token usage when it gives one,
// else estimated at four characters a token.
/**
 * @param {string} model
 * @param {{ prompt_tokens?: number, input_tokens?: number, completion_tokens?: number, output_tokens?: number } | undefined} usage
 * @param {number} inChars
 * @param {number} outChars
 */
export function textCost(model, usage, inChars, outChars) {
  const [i, o] = TEXT[model] || [45455, 136364];
  const pin = (usage && (usage.prompt_tokens || usage.input_tokens)) || Math.ceil(inChars / 4);
  const pout = (usage && (usage.completion_tokens || usage.output_tokens)) || Math.ceil(outChars / 4);
  return (pin * i + pout * o) / 1e6;
}
/** @type {(model: string, chars: number) => number} */
export const voiceCost = (model, chars) => (VOICE[model] || VOICE['@cf/deepgram/aura-2-en'])(chars);
// The most a question can cost before it's asked (a full context and a long answer).
export const ASK_RESERVE = 60;

const today = () => new Date().toISOString().slice(0, 10);
/** @type {(env: Env, kind: Share) => number} */
const cap = (env, kind) => Number(env[`AI_CAP_${kind.toUpperCase()}`]) || CAPS[kind];

export class BudgetError extends Error {}

// Is there room for `need` more neurons in this share today? Throws BudgetError if not.
/** @param {Env} env @param {Share} kind @param {number} need */
export async function check(env, kind, need) {
  if (!env.DB) return; // local tests without a database
  let row;
  try {
    row = /** @type {{ neurons: number } | null} */ (
      await env.DB.prepare('SELECT neurons FROM ai_budget WHERE day = ? AND kind = ?').bind(today(), kind).first()
    );
  } catch (e) {
    throw new BudgetError('budget unavailable: ' + errorMessage(e));
  }
  const spent = (row && row.neurons) || 0;
  if (spent + need > cap(env, kind))
    throw new BudgetError(`daily ${kind} budget used (${Math.round(spent)} of ${cap(env, kind)} neurons)`);
}

/** @param {Env} env @param {Share} kind @param {number} neurons */
export async function charge(env, kind, neurons) {
  if (!env.DB || !(neurons > 0)) return;
  try {
    await env.DB.prepare(
      'INSERT INTO ai_budget (day, kind, neurons, calls) VALUES (?, ?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET neurons = neurons + excluded.neurons, calls = calls + 1',
    )
      .bind(today(), kind, Math.round(neurons * 100) / 100)
      .run();
  } catch (e) {
    console.log('budget charge failed:', errorMessage(e));
  }
}

// Workers AI says the account's free allocation is used up (on the Free plan): stop every share
// for the rest of the day rather than keep asking.
/** @type {(e: unknown) => boolean} */
export const exhausted = (e) => /\b(4006|3036)\b|daily free allocation|free allocation of/i.test(errorMessage(e));
/** @param {Env} env */
export async function closeDay(env) {
  for (const kind of /** @type {Share[]} */ (Object.keys(CAPS))) await charge(env, kind, cap(env, kind));
}
