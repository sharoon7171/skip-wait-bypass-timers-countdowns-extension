import { hostnameMatches } from '../../utils/domain-check';
import {
  LINKNEXT_HOSTS,
  LINKNEXT_MEDIATOR_HOSTS,
  PROFITSFLY_BLOG_SUFFIXES,
} from './hosts';

export type LinknextPhase = 'alias' | 'mediator' | 'blog' | 'tk';

const SSID_RE = /[a-f0-9]{32}/;
const LINKNEXT_STATIC_PATH =
  /^\/(?:pages|auth|payout-rates|sitemap|api|links|blue_theme|js|img|cdn-cgi)(?:\/|$)/i;
const LINKNEXT_ALIAS_PATH = /^\/[A-Za-z0-9_-]{2,}\/?$/;
const BLOG_STATIC_PATH = /^\/(?:api|cdn-cgi)(?:\/|$)/i;

const parseUrl = (href: string): URL | null => {
  try {
    return new URL(href);
  } catch {
    return null;
  }
};

const isLinknextAliasPath = (pathname: string): boolean =>
  !LINKNEXT_STATIC_PATH.test(pathname) && LINKNEXT_ALIAS_PATH.test(pathname);

export function isLinknextHost(href = location.href): boolean {
  const u = parseUrl(href);
  return u ? hostnameMatches(u.hostname, LINKNEXT_HOSTS) : false;
}

export function isLinknextMediatorPage(href = location.href): boolean {
  const u = parseUrl(href);
  if (!u || !hostnameMatches(u.hostname, LINKNEXT_MEDIATOR_HOSTS)) return false;
  const ssid = u.searchParams.get('ssid');
  return !!ssid && SSID_RE.test(ssid);
}

export function isProfitsflyBlogPage(href = location.href): boolean {
  const u = parseUrl(href);
  if (!u || !hostnameMatches(u.hostname, PROFITSFLY_BLOG_SUFFIXES)) return false;
  const h = u.hostname.toLowerCase();
  if (h.startsWith('www.')) return false;
  if (!h.split('.').slice(0, -2).join('.')) return false;
  return !BLOG_STATIC_PATH.test(u.pathname);
}

export function linknextPhase(href = location.href): LinknextPhase | null {
  const u = parseUrl(href);
  if (!u) return null;
  if (hostnameMatches(u.hostname, LINKNEXT_HOSTS)) {
    if (u.searchParams.has('tk')) return 'tk';
    if (isLinknextAliasPath(u.pathname)) return 'alias';
    return null;
  }
  if (isProfitsflyBlogPage(href)) return 'blog';
  if (isLinknextMediatorPage(href)) return 'mediator';
  return null;
}

export function isLinknextPipelinePage(): boolean {
  return linknextPhase() !== null;
}
