// Chrome origin trials (WebMCP): each token in src/origin-trials.txt is tied to one origin, so
// only the one for the origin the page is on is added. Tokens added by script count for
// third-party matching, which a <meta> in the HTML wouldn't.
import tokens from '../origin-trials.txt?raw';

for (const t of tokens.split('\n').map((l) => l.trim())) {
  if (!t || t.startsWith('#')) continue;
  try {
    // The token's payload, after its 69-byte signature header, says which origin it's for.
    const bytes = Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
    const info = JSON.parse(new TextDecoder().decode(bytes.subarray(69))) as { origin: string; expiry: number };
    if (new URL(info.origin).origin !== location.origin || info.expiry * 1000 < Date.now()) continue;
    const m = document.createElement('meta');
    m.httpEquiv = 'origin-trial';
    m.content = t;
    document.head.append(m);
  } catch {
    // A token that can't be read: skipped.
  }
}
