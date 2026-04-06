import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const ALLOWED_HOSTS = ['shikshakdaak.com'];

function externalDownloadHref(): string | undefined {
  const a = document.getElementById('download');
  if (!(a instanceof HTMLAnchorElement)) return;
  const raw = a.getAttribute('href')?.trim() ?? '';
  if (!raw || raw === '#' || raw.toLowerCase().startsWith('javascript:')) return;
  try {
    const href = new URL(a.href, location.href).href;
    if (!/^https?:/i.test(href) || new URL(href).origin === location.origin) return;
    return href;
  } catch {
    return;
  }
}

function isShareDrivePath(pathname: string): boolean {
  const id = pathname.match(/^\/drive\/([^/]+)/)?.[1];
  return Boolean(id && id !== 'admin');
}

export function initShikshakdaakHubcloudDrive(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  let pathname: string;
  try {
    pathname = new URL(location.href).pathname;
  } catch {
    return;
  }
  if (!isShareDrivePath(pathname)) return;
  whenDomParsed(() => {
    const go = (): boolean => {
      const href = externalDownloadHref();
      if (!href) return false;
      location.replace(href);
      return true;
    };
    if (go()) return;
    const mo = new MutationObserver(() => {
      if (go()) mo.disconnect();
    });
    mo.observe(document.documentElement, {
      attributeFilter: ['href'],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}
