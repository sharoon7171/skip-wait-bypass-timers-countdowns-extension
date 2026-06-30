import { hostnameMatches, isAllowedHost } from '../../utils/domain-check';

const HUBCLOUD_DRIVE_HOSTS = [
  'hubcloud.cx',
  'hubcloud.foo',
  'hubcloud.club',
  'hubcloud.fans',
  'vcloud.zip',
] as const;

const VCLOUD_HOSTS = ['vcloud.zip'] as const;
const HUBCLOUD_PHP_RE = /https?:\/\/[^'"\s]+\/hubcloud\.php\?[^'"\s]+/i;
const VCLOUD_URL_RE = /var\s+url\s*=\s*atob\s*\(\s*atob\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)\s*\)/;
const HUBCLOUD_DRIVE_PATH_RE = /^\/drive\/(?!admin(?:\/|$))[\w-]+\/?$/i;
const VCLOUD_FILE_PATH_RE = /^\/(?!admin(?:\/|$))[\w-]+\/?$/i;

const isSharePath = (): boolean => {
  const { pathname } = location;
  if (hostnameMatches(location.hostname, VCLOUD_HOSTS)) {
    return pathname !== '/' && VCLOUD_FILE_PATH_RE.test(pathname);
  }
  return HUBCLOUD_DRIVE_PATH_RE.test(pathname);
};

const resolveTarget = (): string | null => {
  const a = document.getElementById('download');
  if (a instanceof HTMLAnchorElement && HUBCLOUD_PHP_RE.test(a.href)) return a.href;
  for (const s of document.scripts) {
    const t = s.textContent ?? '';
    const php = t.match(HUBCLOUD_PHP_RE);
    if (php) return php[0];
    const vcloud = t.match(VCLOUD_URL_RE);
    if (vcloud?.[1]) {
      try {
        return atob(atob(vcloud[1]));
      } catch {
        continue;
      }
    }
  }
  return null;
};

export function initHubcloudDrive(): void {
  if (!isAllowedHost(HUBCLOUD_DRIVE_HOSTS) || !isSharePath()) return;

  const redirect = (): boolean => {
    const url = resolveTarget();
    if (!url || !/^https?:\/\//i.test(url)) return false;
    location.replace(url);
    return true;
  };

  if (redirect()) return;
  const id = window.setInterval(() => {
    if (redirect()) clearInterval(id);
  }, 50);
}
