import { NITROLINK_HOSTS } from './hosts';

const CHAIN_KEY = 'sw-nitrolink-chain' as const;
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

export type NitrolinkChain = {
  alias: string;
  origin: string;
  startedAt: number;
};

const storageReady = (): boolean => {
  try {
    return Boolean(chrome?.runtime?.id && chrome.storage?.local);
  } catch {
    return false;
  }
};

export function nitrolinkAliasFromPath(pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const seg = parts[0]!;
  return ALIAS_RE.test(seg) ? seg : null;
}

export function nitrolinkAliasFromSearch(search: string): string | null {
  try {
    const alias = new URLSearchParams(search).get('alias');
    if (alias && ALIAS_RE.test(alias)) return alias;
  } catch {}
  return null;
}

export async function readNitrolinkChain(): Promise<NitrolinkChain | null> {
  if (!storageReady()) return null;
  try {
    const data = await chrome.storage.local.get(CHAIN_KEY);
    const raw = data[CHAIN_KEY] as Partial<NitrolinkChain> | undefined;
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.alias !== 'string' || !ALIAS_RE.test(raw.alias)) return null;
    if (typeof raw.origin !== 'string' || !/^https?:\/\//i.test(raw.origin)) return null;
    if (typeof raw.startedAt !== 'number' || raw.startedAt <= 0) return null;
    return { alias: raw.alias, origin: raw.origin.replace(/\/$/, ''), startedAt: raw.startedAt };
  } catch {
    return null;
  }
}

export async function ensureNitrolinkChain(alias: string, origin: string): Promise<NitrolinkChain> {
  const normalized = origin.replace(/\/$/, '');
  const existing = await readNitrolinkChain();
  if (existing && existing.alias === alias && existing.origin === normalized) {
    return existing;
  }
  const chain: NitrolinkChain = { alias, origin: normalized, startedAt: Date.now() };
  if (!storageReady()) return chain;
  try {
    await chrome.storage.local.set({ [CHAIN_KEY]: chain });
  } catch {}
  return chain;
}

export async function clearNitrolinkChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(CHAIN_KEY);
  } catch {}
}

export function shortenerUrl(chain: NitrolinkChain): string {
  return `${chain.origin}/${chain.alias}`;
}

export function isNitrolinkShortenerHref(href: string): boolean {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!NITROLINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    return nitrolinkAliasFromPath(u.pathname) !== null;
  } catch {
    return false;
  }
}
