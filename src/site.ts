// Facts about the site that several pages and build steps share.
import ask from '../ask.config.json' with { type: 'json' };

export const SITE = 'https://craigthompson.dev';
export const NAME = 'Craig Thompson';
export const EMAIL = 'craga89@gmail.com';
export const GITHUB = 'https://github.com/Craga89';
export const LINKEDIN = 'https://www.linkedin.com/in/craigmichaelthompson/';
export const SOURCE = 'https://github.com/Craga89/portfolio';

/** The ask.sh worker's /ask endpoint ('' = the page answers from its own search). */
export const ASK_ENDPOINT: string = ask.endpoint || '';
export const WORKER_ORIGIN = ASK_ENDPOINT ? new URL(ASK_ENDPOINT).origin : '';

/** Browser chrome colours, [dark, light]. */
export const CHROME = { home: ['#16271F', '#E2EEE8'], cv: ['#111214', '#F4F4F2'] } as const;

/** Search engines stay out until the content is finished (see astro.config.mjs). */
export const INDEXING = import.meta.env.ALLOW_INDEXING === 'true';

export const PORTRAIT_ALT = 'Illustrated portrait of Craig Thompson smiling at his laptop';
export const PORTRAIT_ALT_NIGHT =
  'Illustrated portrait of Craig Thompson smiling at his laptop at night, by the light of a desk lamp';

/** The one-line role, under the name. */
export const ROLE = 'Head of Engineering · hands-on, AI-first';
export const HOME_TITLE = 'Craig Thompson · Head of Engineering, hands-on & AI-first';
export const HOME_DESC =
  'Craig Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK. 20+ years, from start-up to acquisition.';
export const OG_DESC =
  "Hands-on, AI-first Head of Engineering and full-stack engineer. 20+ years' experience in software development and management, from start-up to acquisition.";
export const CV_DESC =
  'CV of Craig Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK, open to technical leadership roles.';
