import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['fastdl.zip'] as const;

export function initFastdlZipRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
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
