import { hostnameMatches } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'linkjust';
const FALLBACK_ROOTS = ['linkjust.com'] as const;

export function linkjustRoots(): readonly string[] {
  const remote = getHostsByKey(KEY);
  return remote.length ? remote : FALLBACK_ROOTS;
}

export function isLinkjustHostname(hostname: string): boolean {
  return hostnameMatches(hostname, linkjustRoots());
}

export function isLinkjustHost(hostname: string = location.hostname): boolean {
  return isLinkjustHostname(hostname);
}

export function linkjustAliasFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (!isLinkjustHostname(u.hostname)) return null;
    const seg = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (!seg || seg.includes('.') || !/^[A-Za-z0-9]+$/.test(seg)) return null;
    if (seg.length < 4 || seg.length > 80) return null;
    return seg;
  } catch {
    return null;
  }
}

export function linkjustUrl(alias: string, host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '');
  return `https://${h}/${alias}`;
}

export function isLinkjustReferer(ref: string): boolean {
  try {
    return isLinkjustHostname(new URL(ref).hostname);
  } catch {
    return false;
  }
}

export async function fetchLinkjustFirstHop(alias: string, host: string): Promise<string | null> {
  try {
    const page = linkjustUrl(alias, host);
    const resp = await fetch(page, {
      redirect: 'manual',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    });
    const loc = resp.headers.get('location');
    if (!loc) return null;
    return new URL(loc, page).href;
  } catch {
    return null;
  }
}

export function destinationFromLinkjustApiUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (!isLinkjustHostname(u.hostname)) return null;
    if (!u.searchParams.has('api') || !u.searchParams.has('url')) return null;
    const urls = u.searchParams.getAll('url');
    for (let i = urls.length - 1; i >= 0; i--) {
      const raw = urls[i]?.trim();
      if (!raw || !/^https?:\/\//i.test(raw)) continue;
      try {
        if (!isLinkjustHostname(new URL(raw).hostname)) return raw;
      } catch {
        return raw;
      }
    }
    return null;
  } catch {
    return null;
  }
}
