import { AROLINKS_HOSTS } from './hosts';

const CHAIN_KEY = 'sw-arolinks-chain' as const;
const UNLOCK_READY_MS = 30_000;
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

export type ArolinksChain = {
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

export function arolinksAliasFromPath(pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const seg = parts[0]!;
  return ALIAS_RE.test(seg) ? seg : null;
}

export async function readArolinksChain(): Promise<ArolinksChain | null> {
  if (!storageReady()) return null;
  try {
    const data = await chrome.storage.local.get(CHAIN_KEY);
    const raw = data[CHAIN_KEY] as Partial<ArolinksChain> | undefined;
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.alias !== 'string' || !ALIAS_RE.test(raw.alias)) return null;
    if (typeof raw.origin !== 'string' || !/^https?:\/\//i.test(raw.origin)) return null;
    if (typeof raw.startedAt !== 'number' || raw.startedAt <= 0) return null;
    return { alias: raw.alias, origin: raw.origin.replace(/\/$/, ''), startedAt: raw.startedAt };
  } catch {
    return null;
  }
}

export async function ensureArolinksChain(alias: string, origin: string): Promise<ArolinksChain> {
  const normalized = origin.replace(/\/$/, '');
  const existing = await readArolinksChain();
  if (existing && existing.alias === alias && existing.origin === normalized) {
    return existing;
  }
  const chain: ArolinksChain = { alias, origin: normalized, startedAt: Date.now() };
  if (!storageReady()) return chain;
  try {
    await chrome.storage.local.set({ [CHAIN_KEY]: chain });
  } catch {}
  return chain;
}

export async function clearArolinksChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(CHAIN_KEY);
  } catch {}
}

export function msUntilUnlockReady(chain: ArolinksChain): number {
  return Math.max(0, chain.startedAt + UNLOCK_READY_MS - Date.now());
}

export function shortenerUrl(chain: ArolinksChain): string {
  return `${chain.origin}/${chain.alias}`;
}

export function isArolinksShortenerHref(href: string): boolean {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!AROLINKS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
    return arolinksAliasFromPath(u.pathname) !== null;
  } catch {
    return false;
  }
}
