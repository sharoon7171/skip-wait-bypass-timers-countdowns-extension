import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['kitokola.id'] as const;
const STORAGE_KEYS = ['mi-active', 'mi-dl', 'mi-start', 'mi-total'];

function clearTimerState(): void {
  try {
    for (const k of STORAGE_KEYS) localStorage.removeItem(k);
  } catch {}
}

function readStoredDownload(): string | null {
  try {
    return localStorage.getItem('mi-dl');
  } catch {
    return null;
  }
}

function readUrlDownload(): string | null {
  try {
    const params = new URL(window.location.href).searchParams;
    return params.get('dl') ?? params.get('get');
  } catch {
    return null;
  }
}

function decodeTarget(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function initKitokolaDlGetBypass(): void {
  if (!isAllowedHost(HOSTS)) return;
  const candidate = readUrlDownload() ?? readStoredDownload();
  if (!candidate) return;
  const target = decodeTarget(candidate);
  if (!target) return;
  clearTimerState();
  window.location.replace(target);
}
