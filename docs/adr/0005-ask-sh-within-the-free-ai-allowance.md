# 0005. ask.sh answers within Workers AI's free allowance

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

ask.sh answers visitors' questions about the CV with a language model, and reads answers aloud. A
public form backed by a paid model can run up costs without limit, and the site is meant to cost
nothing to run.

## Decision

Run ask.sh on a Cloudflare Worker using Workers AI's free daily allowance, answering only from the
site's own passages. `worker/src/budget.js` records spending per UTC day in D1 and splits the
allowance into shares (visitors' answers, read-aloud, the answer tests), so one can't use up
another's. When a share is used up, the Worker refuses the next request, and the page answers from
its own search over the same passages and uses the browser's voice.

On the Free plan, Workers AI itself stops at the allowance, so there's no bill. On a Paid plan the
shares are best-effort: each request checks the day's spending before it runs and records its cost
after, so requests running at the same time can go a little over. The shares add up to less than
the allowance (9,500 of 10,000 neurons) to leave room for that.

## Options considered

- **Workers AI, capped at the free allowance.** No bill on the Free plan, and close to none on a
  Paid one; degrades to search.
- **A paid model API.** Better answers, but costs grow with use and abuse.
- **Search only.** Free and private, but no direct answers.

## Consequences

- ask.sh can't cost money on the Free plan, and fails into something useful.
- Answers are limited by the free models (Gemma 4, then Qwen3, then Llama 3.1), and by the daily
  allowance on busy days. The weekly stats show spending per share.
- The answer tests (`worker/evals.json`) share the allowance, so after a deploy they run only when
  something that changes answers changed. They also run weekly and on demand.
