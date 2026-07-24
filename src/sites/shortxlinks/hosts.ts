import { hostnameMatches } from '../../utils/domain-check';

export const SHORTX_HOSTS = ['shortxlinks.com'] as const;
export const SHORTX_MEDIATOR_HOSTS = [
  'flexthecar.com',
  'nkrmusic.in.net',
  'raisingcanesmenux.com',
  'pcfileszone.com',
] as const;

export const SHORTX_ORIGIN = 'https://shortxlinks.com';
export const SHORTX_AD_WAIT_MS = 25_000;

const ALIAS_RE = /^\/([A-Za-z0-9_-]+)\/?$/i;
const ADLINKFLY_RE = /[?&]adlinkfly=([^?&#]+)/i;
const SHORTX_URL_RE = /https:\/\/shortxlinks\.com\/([A-Za-z0-9_-]+)/i;

export function shortxAliasFromPath(pathname: string): string | null {
  return ALIAS_RE.exec(pathname)?.[1] ?? null;
}

export function shortxAliasFromAdlinkfly(search: string): string | null {
  return ADLINKFLY_RE.exec(search)?.[1] ?? null;
}

export function shortxStartUrl(alias: string): string {
  return `${SHORTX_ORIGIN}/${alias}`;
}

export function shortxStartUrlFromText(text: string): string | null {
  const m = SHORTX_URL_RE.exec(text);
  return m?.[1] ? shortxStartUrl(m[1]) : null;
}

export function isShortxHost(hostname = location.hostname): boolean {
  return hostnameMatches(hostname, SHORTX_HOSTS);
}

export function isShortxMediatorHost(hostname = location.hostname): boolean {
  return hostnameMatches(hostname, SHORTX_MEDIATOR_HOSTS);
}

export function isShortxTokenUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isShortxHost(u.hostname)) return false;
    if (!shortxAliasFromPath(u.pathname)) return false;
    return u.search.length > 1;
  } catch {
    return false;
  }
}

export function isShortxTimerPage(): boolean {
  if (!isShortxHost() || !shortxAliasFromPath(location.pathname)) return false;
  if (document.title.includes('Too Early')) return true;
  if (location.search.length > 1) return true;
  return !!document.querySelector('#go-link, form[action*="/links/go"]');
}

export function isShortxMediatorPage(): boolean {
  if (shortxAliasFromAdlinkfly(location.search)) return true;
  if (!isShortxMediatorHost()) return false;
  return !!document.querySelector(
    'input[name="newwpsafelink"], input[name="go"], #wpsafelinkhuman, #wpsafelink-landing',
  );
}

export function isShortxPipelinePage(): boolean {
  return isShortxTimerPage() || isShortxMediatorPage();
}
