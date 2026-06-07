import { ARTICLE_QS } from './constants';
import { isLinkjustHostname, linkjustAliasFromUrl } from './hosts';

export type LinkjustHopKind = 'article' | 'shortener' | 'destination';

export type LinkjustHop = {
  kind: LinkjustHopKind;
  url: string;
};

function normPath(pathname: string): string {
  const s = pathname.replace(/\/+$/, '').toLowerCase();
  return s === '' ? '/' : s;
}

function normUrl(urlStr: string): string {
  try {
    const x = new URL(urlStr, window.location.origin);
    x.hash = '';
    return `${x.protocol}//${x.host}${x.pathname}${x.search}`.toLowerCase();
  } catch {
    return '';
  }
}

function cleanUrl(raw: string): string {
  return raw.replace(/\\\//g, '/').trim();
}

function anchorHrefs(html: string, id: string): string[] {
  const out: string[] = [];
  const a = html.match(new RegExp(`id=["']${id}["'][^>]*href=["'](https:[^"']+)["']`, 'i'));
  const b = html.match(new RegExp(`href=["'](https:[^"']+)["'][^>]*id=["']${id}["']`, 'i'));
  for (const x of [a?.[1], b?.[1]]) {
    if (x) out.push(cleanUrl(x));
  }
  return out;
}

function scriptVarUrl(html: string, name: string): string | null {
  const m = html.match(new RegExp(`(?:var|let|const)\\s+${name}\\s*=\\s*['"](https:[^'"]+)['"]`, 'i'));
  return m?.[1] ? cleanUrl(m[1]) : null;
}

function optionUrl(html: string, key: string): string | null {
  const m = html.match(new RegExp(`${key}\\s*:\\s*['"](https:[^'"]+)['"]`, 'i'));
  return m?.[1] ? cleanUrl(m[1]) : null;
}

function collectFromDom(): string[] {
  return [
    document.querySelector<HTMLAnchorElement>('a#final-link-wrapper')?.href,
    document.querySelector<HTMLAnchorElement>('a#next-link-wrapper')?.href,
  ].filter((x): x is string => Boolean(x));
}

function collectFromHtml(html: string): string[] {
  const raw: string[] = [];
  raw.push(...anchorHrefs(html, 'final-link-wrapper'), ...anchorHrefs(html, 'next-link-wrapper'));
  const random = scriptVarUrl(html, 'randomLink');
  if (random) raw.push(random);
  const finalLink = optionUrl(html, 'finalLink');
  if (finalLink) raw.push(finalLink);
  const escaped = new RegExp(
    `https:\\\\/\\\\/[a-z0-9][a-z0-9.-]*\\.[a-z]{2,}[^'"\\\\]*(?:\\\\?|&)${ARTICLE_QS}=[\\w-]+`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = escaped.exec(html)) !== null) raw.push(cleanUrl(m[0]));
  return raw;
}

function isHttpUrl(urlStr: string): boolean {
  try {
    const p = new URL(urlStr, window.location.origin).protocol;
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}

function isArticleHop(urlStr: string, alias: string | null): boolean {
  if (!new RegExp(`${ARTICLE_QS}=`, 'i').test(urlStr)) return false;
  if (!alias) return true;
  return new RegExp(`${ARTICLE_QS}=${alias}(?:[^\\w]|$)`, 'i').test(urlStr);
}

function isShortenerReturn(urlStr: string, alias: string | null): boolean {
  try {
    const u = new URL(urlStr);
    if (!isLinkjustHostname(u.hostname)) return false;
    if (isArticleHop(urlStr, alias)) return false;
    const slug = linkjustAliasFromUrl(urlStr);
    if (alias && slug && slug !== alias) return false;
    return Boolean(slug || u.pathname.replace(/^\/+|\/+$/g, '').length >= 4);
  } catch {
    return false;
  }
}

function isExternalDestination(urlStr: string): boolean {
  try {
    const t = new URL(urlStr);
    if (!isLinkjustHostname(t.hostname) && isArticleHop(urlStr, null)) return false;
    if (isLinkjustHostname(t.hostname)) return false;
    const cur = new URL(window.location.href);
    return t.hostname.toLowerCase() !== cur.hostname.toLowerCase();
  } catch {
    return false;
  }
}

function dedupe(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!isHttpUrl(u)) continue;
    const n = normUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(u);
  }
  return out;
}

function pickArticleHop(urls: string[], alias: string | null, visitedPaths: readonly string[]): string | null {
  const cur = normPath(new URL(window.location.href).pathname);
  const article = urls.filter((u) => isArticleHop(u, alias));
  const forward = article.filter((u) => normPath(new URL(u, window.location.origin).pathname) !== cur);
  const fresh = forward.filter((u) => !visitedPaths.includes(normPath(new URL(u, window.location.origin).pathname)));
  return fresh[0] ?? forward[0] ?? null;
}

export function extractLinkjustHop(
  alias: string | null,
  visitedPaths: readonly string[] = [],
): LinkjustHop | null {
  const html = document.documentElement?.innerHTML ?? '';
  const urls = dedupe([...collectFromDom(), ...collectFromHtml(html)]);

  for (const u of urls) {
    if (isShortenerReturn(u, alias)) return { kind: 'shortener', url: u };
  }

  const article = pickArticleHop(urls, alias, visitedPaths);
  if (article) return { kind: 'article', url: article };

  for (const u of urls) {
    if (isExternalDestination(u)) return { kind: 'destination', url: u };
  }

  return null;
}

export function extractLinkjustNextHop(
  alias: string | null,
  visitedPaths: readonly string[] = [],
): string | null {
  return extractLinkjustHop(alias, visitedPaths)?.url ?? null;
}

export function isFinalHop(urlStr: string): boolean {
  try {
    if (isLinkjustHostname(new URL(urlStr).hostname)) return false;
    return isExternalDestination(urlStr);
  } catch {
    return false;
  }
}
