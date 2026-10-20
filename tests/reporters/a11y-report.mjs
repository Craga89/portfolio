// Collects the accessibility projects' results into one JSON report (the `accessibility` branch
// keeps the latest; tools/live.mjs publishes its summary on the site).
//
// Works on a single run or on sharded runs merged with `playwright merge-reports`.
// Each axe run is attached to its test as "axe" (see tests/a11y/axe.mjs). Failing tests that
// aren't axe runs (keyboard, reflow, motion checks) are listed as failures.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

/**
 * @typedef {import('@playwright/test/reporter').Reporter} Reporter
 * @typedef {import('@playwright/test/reporter').TestCase} TestCase
 * @typedef {import('@playwright/test/reporter').TestResult} TestResult
 * @typedef {{ id: string, impact: string | null, help: string, url: string, wcag: string[], target: string, html: string, summary: string }} Violation
 * @typedef {{ label: string, violations: Violation[] }} AxeRun
 */

// Terminal colour codes in error messages.
// oxlint-disable-next-line no-control-regex
const ANSI = /\u001b\[[\d;]*m/g;

/** @implements {Reporter} */
export default class A11yReport {
  /** @param {{ outputFile?: string }} [options] */
  constructor(options = {}) {
    this.outputFile = options.outputFile || 'a11y.json';
    /** @type {Map<string, Violation & { states: string[] }>} */
    this.violations = new Map();
    /** @type {{ check: string, state: string, what: string }[]} */
    this.failures = [];
    this.axeRuns = 0;
    this.tests = 0;
  }

  /** @param {TestCase} test @param {TestResult} result */
  onTestEnd(test, result) {
    const project = test.parent.project()?.name || '';
    if (!project.startsWith('a11y')) return;
    // Only the final attempt counts.
    if (result.retry < test.retries && result.status !== 'passed' && result.status !== 'skipped') return;
    this.tests++;
    for (const a of result.attachments) {
      if (a.name !== 'axe' || !a.body) continue;
      /** @type {AxeRun} */
      const run = JSON.parse(a.body.toString());
      this.axeRuns++;
      for (const v of run.violations) {
        const key = v.id + '|' + v.target;
        const entry = this.violations.get(key) || { ...v, states: [] };
        const state = `${run.label} (${project.replace('a11y-', '')})`;
        if (!entry.states.includes(state)) entry.states.push(state);
        this.violations.set(key, entry);
      }
    }
    if (result.status === 'failed' || result.status === 'timedOut') {
      const isAxe = result.attachments.some((a) => a.name === 'axe');
      if (!isAxe || !result.errors.every((e) => /axe/i.test(e.message || ''))) {
        const what = (result.errors[0]?.message || result.status).replace(ANSI, '').split('\n')[0];
        this.failures.push({ check: test.title, state: project.replace('a11y-', ''), what });
      }
    }
  }

  onEnd() {
    if (!this.tests) return;
    const order = ['critical', 'serious', 'moderate', 'minor'];
    const violations = [...this.violations.values()]
      .map(({ id, ...v }) => ({ rule: id, ...v }))
      .sort((a, b) => order.indexOf(a.impact || 'minor') - order.indexOf(b.impact || 'minor'));
    const report = {
      url: process.env.BASE_URL || 'the built site',
      at: new Date().toISOString(),
      axe: axeVersion(),
      standard: 'WCAG 2.2 AA',
      tests: this.tests,
      axeRuns: this.axeRuns,
      violations,
      failures: this.failures,
      pass: !violations.length && !this.failures.length,
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, JSON.stringify(report, null, 2) + '\n');
    console.log(
      `WCAG 2.2 AA: ${report.pass ? 'pass' : 'FAIL'} (${this.tests} tests, ${this.axeRuns} axe runs, ` +
        `${violations.length} violations, ${this.failures.length} other failures) → ${this.outputFile}`,
    );
  }

  printsToStdio() {
    return false;
  }
}

function axeVersion() {
  try {
    const require = createRequire(import.meta.url);
    return JSON.parse(readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version;
  } catch {
    return 'unknown'; // axe-core isn't installed: no axe runs to report
  }
}
