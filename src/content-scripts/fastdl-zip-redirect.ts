import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'fastdl-zip-redirect';

export function initFastdlZipRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const path = window.location.pathname.toLowerCase();
  if (!path.endsWith('/dl.php')) return;
  let raw: string | null = null;
  try {
    raw = new URL(window.location.href).searchParams.get('link');
  } catch {
    return;
  }
  if (!raw) return;
  let target: string;
  try {
    target = decodeURIComponent(raw);
  } catch {
    return;
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    window.location.href = target;
  }
}
