import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'hubcloud-drive';

const VCLOUD_ROOT = 'vcloud.zip';
const VCLOUD_FILE_ID_MIN_LEN = 10;
const VCLOUD_FILE_ID_MAX_LEN = 128;

function externalHrefFromDownloadAnchor(): string | undefined {
  const el = document.getElementById('download');
  if (!(el instanceof HTMLAnchorElement)) return;
  const raw = el.getAttribute('href')?.trim() ?? '';
  if (!raw || raw === '#' || raw.toLowerCase().startsWith('javascript:')) return;
  try {
    const href = new URL(el.href, location.href).href;
    if (!/^https?:/i.test(href) || new URL(href).origin === location.origin) return;
    return href;
  } catch {
    return;
  }
}

function hubcloudPhpUrlFromInlineScripts(): string | undefined {
  for (const s of document.querySelectorAll('script:not([src])')) {
    const t = s.textContent ?? '';
    const quoted = /(?:\burl\s*=\s*)['"](https?:\/\/[^'"]*hubcloud\.php\?[^'"]+)['"]/gi;
    let m: RegExpExecArray | null;
    while ((m = quoted.exec(t)) !== null) {
      const raw = m[1];
      if (!raw) continue;
      try {
        const u = new URL(raw);
        if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
      } catch {
        continue;
      }
    }
    const bare = t.match(/https?:\/\/[a-z0-9.-]+\/hubcloud\.php\?[\w=%&.+/-]+/gi);
    if (bare?.[0]) {
      try {
        const u = new URL(bare[0]);
        if (u.pathname.includes('hubcloud.php')) return u.href;
      } catch {
        continue;
      }
    }
  }
  return;
}

function resolveHubcloudRedirectTarget(): string | undefined {
  return externalHrefFromDownloadAnchor() ?? hubcloudPhpUrlFromInlineScripts();
}

function isVcloudFileIdSegment(seg: string): boolean {
  if (seg.length < VCLOUD_FILE_ID_MIN_LEN || seg.length > VCLOUD_FILE_ID_MAX_LEN) return false;
  return /^[a-z0-9]+$/i.test(seg);
}

function isVcloudFilePath(pathname: string): boolean {
  const seg = pathname.replace(/\/$/, '').match(/^\/([^/]+)$/)?.[1];
  if (!seg) return false;
  return isVcloudFileIdSegment(seg);
}

function isShikshakDrivePath(pathname: string): boolean {
  const id = pathname.match(/^\/drive\/([^/]+)/)?.[1];
  return Boolean(id && id !== 'admin');
}

function isHubcloudSharePath(pathname: string, hostname: string): boolean {
  const h = hostname.toLowerCase();
  const onVcloud = h === VCLOUD_ROOT || h.endsWith('.' + VCLOUD_ROOT);
  if (onVcloud) return isVcloudFilePath(pathname);
  return isShikshakDrivePath(pathname);
}

export function initHubcloudDrive(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  let pathname: string;
  let hostname: string;
  try {
    const u = new URL(location.href);
    pathname = u.pathname;
    hostname = u.hostname;
  } catch {
    return;
  }
  if (!isHubcloudSharePath(pathname, hostname)) return;
  whenDomParsed(() => {
    const go = (): boolean => {
      const href = resolveHubcloudRedirectTarget();
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
