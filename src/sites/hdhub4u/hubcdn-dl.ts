import { isAllowedHost } from '../../utils/domain-check';

const HUBCDN_HOSTS = ['hubcdn.sbs', 'hubcdn.fans'] as const;
const HUBCDN_DL_PATH_RE = /^\/dl\/?$/i;

export function initHubcdnDl(): void {
  if (!isAllowedHost(HUBCDN_HOSTS) || !HUBCDN_DL_PATH_RE.test(location.pathname)) return;
  let target: string;
  try {
    const raw = new URL(location.href).searchParams.get('link');
    if (!raw) return;
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    if (u.origin === location.origin) return;
    target = u.href;
  } catch {
    return;
  }
  location.replace(target);
}
