import { isAllowedHost } from '../../utils/domain-check';

const HUBCLOUD_DRIVE_HOSTS = [
  'hubcloud.cx',
  'hubcloud.foo',
  'hubcloud.club',
  'hubcloud.fans',
] as const;

const HUBCLOUD_PHP_RE = /https?:\/\/[^'"\s]+\/hubcloud\.php\?[^'"\s]+/i;
const DRIVE_PATH_RE = /^\/drive\/(?!admin(?:\/|$))[\w-]+\/?$/i;

const hubcloudPhpUrl = (): string | null => {
  const a = document.getElementById('download');
  if (a instanceof HTMLAnchorElement && HUBCLOUD_PHP_RE.test(a.href)) return a.href;
  for (const s of document.scripts) {
    const m = (s.textContent ?? '').match(HUBCLOUD_PHP_RE);
    if (m) return m[0];
  }
  return null;
};

export function initHubcloudDrive(): void {
  if (!isAllowedHost(HUBCLOUD_DRIVE_HOSTS) || !DRIVE_PATH_RE.test(location.pathname)) return;

  const redirect = (): boolean => {
    const url = hubcloudPhpUrl();
    if (!url) return false;
    location.replace(url);
    return true;
  };

  if (redirect()) return;
  const id = window.setInterval(() => {
    if (redirect()) clearInterval(id);
  }, 50);
}
