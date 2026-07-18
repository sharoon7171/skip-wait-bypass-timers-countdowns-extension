import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { MIRRORED_HOSTS } from './hosts';

const BRAND_ID = 'skipwait-mirrored-brand';
const FILE_PATH_RE = /^\/files\/([A-Za-z0-9]+)\/?$/i;
const GETLINK_PATH_RE = /^\/getlink\/[A-Za-z0-9]+\/\d+\/?$/i;
const HASH_RE = /^[a-f0-9]{32}$/i;

function fileHash(): string | null {
  const hash = new URLSearchParams(location.search).get('hash');
  return hash && HASH_RE.test(hash) ? hash : null;
}

function unlockHref(): string | null {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="hash="]')) {
    try {
      const u = new URL(a.href, location.origin);
      if (!FILE_PATH_RE.test(u.pathname)) continue;
      const hash = u.searchParams.get('hash');
      if (!hash || !HASH_RE.test(hash) || !u.searchParams.has('dl')) continue;
      if (!a.querySelector('button.get_btn')) continue;
      return u.href;
    } catch {
      continue;
    }
  }
  return null;
}

function mirstatsPath(): string | null {
  const html = document.documentElement.innerHTML;
  const path = html.match(/ajaxRequest\.open\(\s*["']GET["']\s*,\s*["'](\/mirstats\.php\?[^"']+)["']/)?.[1];
  return path ?? null;
}

function isInterstitialPage(): boolean {
  if (!FILE_PATH_RE.test(location.pathname)) return false;
  if (fileHash()) return false;
  if (!document.querySelector('h3.hdark')) return false;
  if (!/You have requested the file/i.test(document.body?.innerText ?? '')) return false;
  return !!unlockHref();
}

function isMirrorsPage(): boolean {
  if (!FILE_PATH_RE.test(location.pathname)) return false;
  if (!fileHash()) return false;
  if (!document.getElementById('result')) return false;
  if (!document.querySelector('.fetch') && !/Fetching hosting links/i.test(document.body?.innerText ?? '')) {
    return false;
  }
  return !!mirstatsPath();
}

function isExternalHostUrl(href: string): boolean {
  try {
    const u = new URL(href, location.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (/mirrored\.to$/i.test(u.hostname) || u.hostname.endsWith('.mirrored.to')) return false;
    if (/^(www\.)?(x|twitter|facebook|google)\./i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function hostUrlFromDocument(root: ParentNode): string | null {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]')) {
    if (!isExternalHostUrl(a.href)) continue;
    if (!a.querySelector('button.get_btn')) continue;
    if (!/Download from/i.test(a.textContent ?? '')) continue;
    return a.href;
  }
  const clip = root.querySelector('[data-clipboard-text^="http"]')?.getAttribute('data-clipboard-text');
  if (clip && isExternalHostUrl(clip)) return clip;
  const code = root.querySelector('code')?.textContent?.trim();
  if (code && isExternalHostUrl(code)) return code;
  return null;
}

function isGetlinkPage(): boolean {
  if (!GETLINK_PATH_RE.test(location.pathname)) return false;
  if (!/^Your .+ Link/i.test(document.title)) return false;
  if (!/Awesome!\s*You have chosen the hosting site/i.test(document.body?.innerText ?? '')) {
    return false;
  }
  return !!hostUrlFromDocument(document);
}

function mountBrand(): void {
  if (document.getElementById(BRAND_ID)) return;
  const meta = document.querySelector('.col-sm.centered .bg.double-padded');
  if (!meta) return;

  const row = document.createElement('span');
  row.id = BRAND_ID;
  row.setAttribute('role', 'status');

  const icon = document.createElement('div');
  icon.className = 'icon baseline2';
  icon.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1.25 17.292l-4.5-4.364 1.857-1.858 2.643 2.506 5.643-5.784 1.857 1.857-7.5 7.643z"/></svg>';

  const value = document.createElement('span');
  value.className = 'id_Success';
  value.textContent = 'Host list ready — click opens the host.';

  row.append(icon, '\u00a0\u00a0Skip Wait : ', value);
  meta.append(document.createElement('br'), row);
}

async function resolveHostUrl(getlinkUrl: string, body?: FormData): Promise<string | null> {
  const init: RequestInit = body
    ? { method: 'POST', body, credentials: 'include', cache: 'no-store' }
    : { method: 'GET', credentials: 'include', cache: 'no-store' };
  const res = await fetch(getlinkUrl, init);
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  return hostUrlFromDocument(doc);
}

function getlinkActionUrl(el: Element): string | null {
  try {
    if (el instanceof HTMLFormElement) {
      const action = el.getAttribute('action');
      if (!action) return null;
      const u = new URL(action, location.origin);
      return GETLINK_PATH_RE.test(u.pathname) ? u.href : null;
    }
    if (el instanceof HTMLAnchorElement) {
      const u = new URL(el.href, location.origin);
      return GETLINK_PATH_RE.test(u.pathname) ? u.href : null;
    }
  } catch {
    return null;
  }
  return null;
}

function wireMirrorHostClicks(root: Element): void {
  root.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null;
      if (!target?.closest('button.get_btn')) return;
      if (target.closest('a[href^="javascript"], [onclick*="showStatus"]')) return;

      const form = target.closest<HTMLFormElement>('form[action*="/getlink/"]');
      const anchor = target.closest<HTMLAnchorElement>('a[href*="/getlink/"]');
      const source = form ?? anchor;
      if (!source) return;

      const getlinkUrl = getlinkActionUrl(source);
      if (!getlinkUrl) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const body = form ? new FormData(form) : undefined;
      void resolveHostUrl(getlinkUrl, body).then((host) => {
        if (host) location.assign(host);
      });
    },
    true,
  );
}

async function injectMirrors(): Promise<void> {
  const result = document.getElementById('result');
  const path = mirstatsPath();
  if (!result || !path) return;

  const res = await fetch(path, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.text();
  if (!html.includes('/getlink/') || !html.includes('id="done"')) return;
  result.innerHTML = html;
  wireMirrorHostClicks(result);
}

function runInterstitial(): void {
  const href = unlockHref();
  if (href) location.replace(href);
}

function runMirrorsPage(): void {
  mountBrand();
  void injectMirrors();
}

function runGetlinkPage(): void {
  const host = hostUrlFromDocument(document);
  if (host) location.replace(host);
}

function run(): void {
  if (isInterstitialPage()) {
    runInterstitial();
    return;
  }
  if (isMirrorsPage()) {
    runMirrorsPage();
    return;
  }
  if (isGetlinkPage()) runGetlinkPage();
}

export function initMirroredFilesPage(): void {
  if (!isAllowedHost(MIRRORED_HOSTS)) return;
  if (!FILE_PATH_RE.test(location.pathname) && !GETLINK_PATH_RE.test(location.pathname)) return;
  whenDomParsed(run);
}
