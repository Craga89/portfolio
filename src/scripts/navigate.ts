// Going somewhere on the site. The home page handles its own links (opening a tab, a file, a
// section) without a reload: it cancels the craga:go event. Anything it doesn't handle loads.
export function navigate(path: string) {
  const u = new URL(path, location.href);
  const here = u.origin === location.origin && u.pathname === location.pathname;
  if (here && !dispatchEvent(new CustomEvent('craga:go', { detail: u, cancelable: true }))) return;
  location.href = u.href;
}
