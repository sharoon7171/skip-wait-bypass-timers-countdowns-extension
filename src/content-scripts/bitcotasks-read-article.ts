import { hostnameMatches } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'bitcotasks-read-article';
const READ_ARTICLE = '/read-article/';
const HREF_PATTERN = /location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
const BLOCKED_PATTERN = /bitcotasks\.com\/detected\.html/i;

function isBitcotasksReadArticlePage(): boolean {
  try {
    const { hostname, pathname } = new URL(window.location.href);
    return hostnameMatches(hostname, getHostsByKey(KEY)) && pathname.includes(READ_ARTICLE);
  } catch {
    return false;
  }
}

function decodeBase64UrlSafe(segment: string): string {
  const padding = segment.length % 4;
  const padded = padding ? segment + '='.repeat(4 - padding) : segment;
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

function extractUdataFromPathname(): string | null {
  const segment = location.pathname.match(/\/read-article\/([^/]+)/)?.[1];
  if (!segment) return null;
  try {
    const decoded = decodeBase64UrlSafe(segment);
    const parts = decoded.split('|');
    if (parts.length < 3) return null;
    const [a, b, timer] = parts;
    return btoa(`${timer}|${a}|${b}`);
  } catch {
    return null;
  }
}

function findLastValidHref(): string | null {
  const scriptsText = [...document.querySelectorAll('script:not([src])')]
    .map((script) => script.textContent ?? '')
    .join('\n');
  let lastUrl: string | null = null;
  for (const match of scriptsText.matchAll(HREF_PATTERN)) {
    const url = match[1];
    if (url && !BLOCKED_PATTERN.test(url)) lastUrl = url;
  }
  return lastUrl;
}

function buildDestinationUrl(): string | null {
  const baseUrl = findLastValidHref();
  if (!baseUrl) return null;
  const udata = extractUdataFromPathname();
  if (!udata) return baseUrl;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('udata', udata);
    return url.href;
  } catch {
    return null;
  }
}

export function initBitcotasksReadArticle(): void {
  if (!isBitcotasksReadArticlePage()) return;
  const performRedirect = () => {
    const destination = buildDestinationUrl();
    if (destination) location.replace(destination);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performRedirect, { once: true });
  } else {
    performRedirect();
  }
}
