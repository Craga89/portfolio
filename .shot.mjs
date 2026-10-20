// usage: node shot.mjs <path> [width] [theme]  → screenshots ref and new side by side files
import { chromium } from 'playwright';
const [path = '', w = '1280', theme = 'dark'] = process.argv.slice(2);
const out = '/tmp/claude-0/-home-claude/164036dd-75d9-5e7d-a21e-3695b48321a9/scratchpad/shots/';
const b = await chromium.launch();
for (const [name, port] of [['ref', 4174], ['new', 4175]]) {
  const ctx = await b.newContext({ viewport: { width: +w, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://127.0.0.1:${port}/${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const f = out + `${name}-${path.replace(/\W+/g, '_') || 'home'}-${w}.png`;
  await p.screenshot({ path: f, fullPage: true });
  console.log(f, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await b.close();
