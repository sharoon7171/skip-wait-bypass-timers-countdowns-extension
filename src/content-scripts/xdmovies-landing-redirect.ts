import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'xdmovies-landing';
const ANCHOR_RE = /<a\b[^>]*\shref="(https?:\/\/[^"]+)"/gi;

function pickDestination(html: string): string | null {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(ANCHOR_RE)) {
    const raw = m[1];
    if (!raw) continue;
    try {
      const u = new URL(raw);
      if (u.hostname === location.hostname) continue;
      const key = u.origin + '/';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } catch {}
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [url, n] of counts) {
    if (n > bestCount) {
      best = url;
      bestCount = n;
    }
  }
  return best;
}

export function initXdmoviesLandingRedirect(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  fetch(location.href, { credentials: 'omit' })
    .then((r) => (r.ok ? r.text() : null))
    .then((html) => {
      if (!html) return;
      const dest = pickDestination(html);
      if (dest) window.location.replace(dest);
    })
    .catch(() => {});
}
