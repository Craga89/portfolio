// humans.txt: who made the site, and with what.
import type { APIRoute } from 'astro';
import { EMAIL, GITHUB, NAME, SOURCE } from '../site';

export const GET: APIRoute = () =>
  new Response(`/* TEAM */
Name: ${NAME}
Role: Head of Engineering, full-stack engineer
Contact: ${EMAIL}
GitHub: ${GITHUB}
From: Newcastle upon Tyne, UK

/* SITE */
Last update: ${new Date().toISOString().slice(0, 10)}
Standards: HTML, CSS, TypeScript, WCAG 2.2 AA
Components: Astro, with the content in Markdown and MDX
Fonts: Big Shoulders Display, Public Sans, Red Hat Mono, Inter (self-hosted)
Hosting: GitHub Pages; ask.sh on Cloudflare Workers AI
Source: ${SOURCE}
`);
