// Inline markdown for the short texts kept in src/data (links, bold and emphasis only), as HTML.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inlineMd(src: string, vars: Record<string, string> = {}): string {
  let html = esc(src);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => `<a href="${href}">${text}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // {name} → the value, marked so scripts/live.ts can refresh it.
  html = html.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? `<span data-oss="${name}">${esc(vars[name])}</span>` : m,
  );
  return html;
}
