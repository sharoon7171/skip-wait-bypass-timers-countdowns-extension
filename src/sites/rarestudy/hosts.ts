import { hostnameMatches } from '../../utils/domain-check';

export const RARESTUDY_HOSTS = ['rarestudy.in'] as const;
export const RARESTUDY_WAIT_MS = 252_000;

export function decodeProlinkDest(id: string): string | null {
  try {
    const raw = id.replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const dest = atob(padded).trim();
    return /^https?:\/\//i.test(dest) ? dest : null;
  } catch {
    return null;
  }
}

export function isRarestudySuccessUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return (
      hostnameMatches(u.hostname, RARESTUDY_HOSTS) &&
      u.pathname.replace(/\/+$/, '') === '/keyloginsuccess'
    );
  } catch {
    return false;
  }
}
