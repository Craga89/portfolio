// The few shell commands ask.sh answers itself, without the AI.
import { lightBridge } from './bridge';
import { EMAIL } from '../site';

type Passage = { id: string; kind: string; title: string; text: string };

export const isShell = (q: string) => /^(help|man( \S+)?|ls( \S+)?|whoami|pwd|date|clear|contact|cat \S+|echo .*|sudo( .*)?|exit|bridge|lights)$/i.test(q.trim());

export function shell(raw: string, index: { passages: Passage[]; byId: Record<string, Passage> }): { answer?: string; clear?: boolean } {
  const q = raw.trim();
  const [cmd, ...rest] = q.split(/\s+/);
  const arg = rest.join(' ').replace(/^\.\//, '');
  const c = cmd.toLowerCase();
  const file = (p: Passage) => String(p.title).split(':')[0].trim();
  const files = (kind: string) => index.passages.filter((p) => p.kind === kind).map(file);
  const sentences = (t: string, n: number) =>
    t
      .split(/(?<=\.)\s/)
      .slice(0, n)
      .join(' ');
  switch (c) {
    case 'help':
    case 'man':
      return { answer: 'Commands: help, ls, ls case-studies, ls responsibilities, cat <file>, whoami, pwd, date, contact, clear.\nAnything else is a question for ask.sh.' };
    case 'ls': {
      const a = arg.replace(/\/$/, '').toLowerCase();
      if (a === 'case-studies') return { answer: files('case').join('  ') };
      if (a === 'responsibilities') return { answer: files('resp').join('  ') };
      if (a === 'stack' || a === 'open-source') return { answer: `Open ${a}/ on the page for the full list.` };
      if (a && a !== '.' && a !== '~') return { answer: `ls: ${arg}: No such directory. Try ls on its own.` };
      return { answer: 'README.md  career.log  responsibilities/  case-studies/  stack/  open-source/  blog/  recommendations.txt  faq.md  ask.sh  cv.json  cv.pdf  contact.vcf' };
    }
    case 'whoami':
      return { answer: "visitor\nYou're reading the portfolio of Craig Michael Thompson: Head of Engineering, hands-on and AI-first, in Newcastle upon Tyne, UK." };
    case 'pwd':
      return { answer: '/home/craig/portfolio' };
    case 'date':
      return { answer: new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ' in Newcastle (Europe/London)' };
    case 'contact':
      return { answer: `email  ${EMAIL}\ncard   contact.vcf\ncv     cv.pdf` };
    case 'clear':
      return { clear: true };
    case 'bridge':
    case 'lights':
      setTimeout(lightBridge, 300);
      return { answer: 'Lighting up the Tyne Bridge. Scroll to the top if you missed it.' };
    case 'echo':
      return { answer: arg };
    case 'exit':
      return { answer: "There's no exit. The chat bar is always here if you need it." };
    case 'sudo':
      return { answer: `craig is not in the sudoers file. This incident will be reported to Craig, who would be glad to hear from you: ${EMAIL}` };
    case 'cat': {
      const f = arg.toLowerCase();
      if (f === 'cv.json') return { answer: 'cv.json is the CV as JSON Resume. Open cv.json, or cv.pdf for a printable copy.' };
      if (f === 'readme.md') return { answer: index.byId.intro ? sentences(index.byId.intro.text, 3) : 'See README.md.' };
      if (f === 'faq.md')
        return {
          answer: index.passages
            .filter((p) => /^faq-/.test(p.id))
            .map((p) => '- ' + String(p.title).replace(/^FAQ:\s*/, ''))
            .join('\n'),
        };
      if (f === 'career.log')
        return {
          answer:
            index.passages
              .filter((p) => /^career-/.test(p.id))
              .map((p) => '- ' + p.title)
              .join('\n') + '\nSee career.log.',
        };
      const hit = index.passages.find((p) => (p.kind === 'resp' || p.kind === 'case') && file(p).toLowerCase() === f);
      if (hit) return { answer: sentences(hit.text.replace(/^\/\/.*?\s(?=[A-Z])/, ''), 3) + `\nSee ${file(hit)}.` };
      return { answer: `cat: ${arg}: No such file. Try ls.` };
    }
  }
  return { answer: `${q}: command not found. Try help.` };
}
