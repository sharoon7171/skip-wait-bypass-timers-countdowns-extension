import { CUT4MONEY_HOSTS } from './hosts';

const CHAIN_KEY = 'sw-cut4money-chain' as const;
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

export type Cut4moneyChain = {
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

export function cut4moneyAliasFromPath(pathname: string): string | null {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const seg = parts[0]!;
  return ALIAS_RE.test(seg) ? seg : null;
}

export function cut4moneyAliasFromHref(href: string): string | null {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!CUT4MONEY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return cut4moneyAliasFromPath(u.pathname);
  } catch {
    return null;
  }
}

export function cut4moneyOriginFromHref(href: string): string | null {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    if (!CUT4MONEY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function cut4moneyAliasFromCookie(): string | null {
  try {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0] ?? '';
      const m = /^ref([A-Za-z0-9]{4,})$/.exec(name);
      if (m?.[1] && ALIAS_RE.test(m[1])) return m[1];
    }
  } catch {}
  return null;
}

export async function readCut4moneyChain(): Promise<Cut4moneyChain | null> {
  if (!storageReady()) return null;
  try {
    const data = await chrome.storage.local.get(CHAIN_KEY);
    const raw = data[CHAIN_KEY] as Partial<Cut4moneyChain> | undefined;
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.alias !== 'string' || !ALIAS_RE.test(raw.alias)) return null;
    if (typeof raw.origin !== 'string' || !/^https?:\/\//i.test(raw.origin)) return null;
    if (typeof raw.startedAt !== 'number' || raw.startedAt <= 0) return null;
    return { alias: raw.alias, origin: raw.origin.replace(/\/$/, ''), startedAt: raw.startedAt };
  } catch {
    return null;
  }
}

export async function ensureCut4moneyChain(
  alias: string,
  origin: string,
): Promise<Cut4moneyChain> {
  const normalized = origin.replace(/\/$/, '');
  const existing = await readCut4moneyChain();
  if (existing && existing.alias === alias && existing.origin === normalized) {
    return existing;
  }
  const chain: Cut4moneyChain = { alias, origin: normalized, startedAt: Date.now() };
  if (!storageReady()) return chain;
  try {
    await chrome.storage.local.set({ [CHAIN_KEY]: chain });
  } catch {}
  return chain;
}

export async function clearCut4moneyChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(CHAIN_KEY);
  } catch {}
}

export function shortenerUrl(chain: Cut4moneyChain): string {
  return `${chain.origin}/${chain.alias}`;
}

export function isCut4moneyShortenerHref(href: string): boolean {
  return cut4moneyAliasFromHref(href) !== null;
}
