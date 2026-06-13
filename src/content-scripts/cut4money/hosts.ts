export const DEFAULT_SHORTENER_HOSTS = ['shr2.link', 'nitro-link.com'] as const;

export function isShortenerHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return DEFAULT_SHORTENER_HOSTS.some((root) => h === root || h.endsWith(`.${root}`));
}

export function isShortenerHost(hostname: string = location.hostname): boolean {
  return isShortenerHostname(hostname);
}

export function shortenerAliasFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (!isShortenerHostname(u.hostname)) return null;
    const seg = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (!seg || seg.length < 4) return null;
    return seg;
  } catch {
    return null;
  }
}

export function shortenerUrl(alias: string, host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '');
  return `https://${h}/${alias}`;
}

export function isShortenerPleaseWait(html: string): boolean {
  if (html.length > 2800) return false;
  return /please\s*wait|redirecting/i.test(html);
}
