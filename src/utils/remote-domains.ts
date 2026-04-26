const REMOTE_URL =
  'https://raw.githubusercontent.com/sharoon7171/skip-wait-bypass-timers-countdowns-extension/main/domains.json';

export type DomainsMap = { readonly [key: string]: readonly string[] };

let CURRENT: DomainsMap = {};

function isDomainsMap(value: unknown): value is DomainsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(v) || !v.every((item) => typeof item === 'string')) return false;
  }
  return true;
}

async function fetchRemote(): Promise<DomainsMap | null> {
  try {
    const url = `${REMOTE_URL}?t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isDomainsMap(data) ? data : null;
  } catch {
    return null;
  }
}

export function getHostsByKey(key: string): readonly string[] {
  return CURRENT[key] ?? [];
}

export async function bootstrapRemoteDomains(): Promise<void> {
  const fresh = await fetchRemote();
  if (!fresh) return;
  CURRENT = fresh;
}
