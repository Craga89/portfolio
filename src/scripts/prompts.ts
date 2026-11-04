// The section headings ("$ cat career.log # experience") type themselves out as they scroll in
// (.c-cmd in base.css), one step per character: the step count is each heading's length.
import { $$ } from './dom';

for (const h of $$('.c-cmd')) h.style.setProperty('--steps', String(Math.max(1, (h.textContent ?? '').trim().length)));
