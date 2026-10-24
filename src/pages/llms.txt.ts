// llms.txt: a plain summary for AI assistants, from the CV (src/cv.json).
import type { APIRoute } from 'astro';
import cv from '../cv.json';
import { ASK_ENDPOINT, GITHUB, LINKEDIN, SITE } from '../site';

type Work = {
  name: string;
  position: string;
  startDate: string;
  endDate?: string;
  summary: string;
  highlights?: string[];
};

export const GET: APIRoute = () => {
  const b = cv.basics;
  const job = (w: Work) =>
    `### ${w.position}, ${w.name} (${w.startDate.slice(0, 4)}${w.endDate ? '–' + w.endDate.slice(0, 4) : '–present'})\n\n${w.summary}\n${(w.highlights ?? []).map((h) => '\n- ' + h).join('')}`;
  const mcp = ASK_ENDPOINT ? ASK_ENDPOINT.replace(/\/ask$/, '/mcp') : '(not configured)';
  return new Response(`# ${b.name}

> ${b.label}. ${b.summary}

Location: ${b.location.city}, UK. Contact: ${b.email}.

## Links

- [Portfolio](${SITE}/): career, responsibilities, case studies, stack, open source, FAQ and ask.sh
- [Plain CV](${SITE}/cv/), also as [PDF](${SITE}/cv.pdf) and [JSON Resume](${SITE}/cv.json)
- [GitHub](${GITHUB})
- [LinkedIn](${LINKEDIN})

For AI agents: the same content is available as tools (get_profile, get_career, list_files, read_file, search_site, ask, get_open_source, get_site_report) from the MCP server at ${mcp}, and on the portfolio page itself in browsers with WebMCP.

## Experience

${(cv.work as Work[]).map(job).join('\n\n')}

## Education

${cv.education.map((e) => `- ${e.studyType}, ${e.area}, ${e.institution} (${e.startDate}–${e.endDate})`).join('\n')}

## Skills

${cv.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`).join('\n')}
`);
};
