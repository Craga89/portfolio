// Where the site is served from: "/" on craigthompson.dev, or "/preview/<branch>/" for a preview
// of a branch (PREVIEW_BASE at build time). Every link and fetch to the site's own pages and files
// goes through url(), so the same build works in either place.
export const BASE: string = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** True for a preview build. */
export const PREVIEW = BASE !== '/';

/**
 * A path on this site ("/cv/", "/#faq", "/?ask=…"), under BASE. A path already under it, and
 * anything that isn't a path on this site, is left alone.
 */
export const url = (path: string) =>
  !path.startsWith('/') || path.startsWith('//') || (PREVIEW && path.startsWith(BASE)) ? path : BASE + path.slice(1);
