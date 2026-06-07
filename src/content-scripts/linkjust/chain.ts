import { articleAliasFromHtml, articleAliasFromUrl } from './constants';
import { isLinkjustReferer, linkjustAliasFromUrl, linkjustUrl } from './hosts';

export const LINKJUST_CHAIN_KEY = 'sw-linkjust-chain' as const;
export const LINKJUST_ALIAS_KEY = 'sw-linkjust-alias' as const;
export const CHAIN_STALE_MS = 30 * 60 * 1000;
export const LOOP_RETURN_HOPS = 6;

export type LinkjustChain = {
  alias: string | null;
  shortenerHost: string | null;
  startedAt: number;
  visitedPaths: string[];
  hopCount: number;
};

export const EMPTY_LINKJUST_CHAIN: LinkjustChain = {
  alias: null,
  shortenerHost: null,
  startedAt: 0,
  visitedPaths: [],
  hopCount: 0,
};

function storageReady(): boolean {
  try {
    return Boolean(chrome?.runtime?.id && chrome.storage?.local);
  } catch {
    return false;
  }
}

function normalizeChain(raw: Partial<LinkjustChain> | undefined): LinkjustChain {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LINKJUST_CHAIN };
  return {
    alias: typeof raw.alias === 'string' ? raw.alias : null,
    shortenerHost: typeof raw.shortenerHost === 'string' ? raw.shortenerHost : null,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    visitedPaths: Array.isArray(raw.visitedPaths)
      ? raw.visitedPaths.filter((p): p is string => typeof p === 'string')
      : [],
    hopCount: typeof raw.hopCount === 'number' ? raw.hopCount : 0,
  };
}

export function normArticlePath(href: string = location.href): string {
  try {
    return new URL(href).pathname.replace(/\/+$/, '').toLowerCase();
  } catch {
    return '';
  }
}

export async function readLinkjustChain(): Promise<LinkjustChain> {
  if (!storageReady()) return { ...EMPTY_LINKJUST_CHAIN };
  try {
    const data = await chrome.storage.local.get(LINKJUST_CHAIN_KEY);
    return normalizeChain(data[LINKJUST_CHAIN_KEY] as Partial<LinkjustChain> | undefined);
  } catch {
    return { ...EMPTY_LINKJUST_CHAIN };
  }
}

export async function writeLinkjustChain(chain: LinkjustChain): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.set({ [LINKJUST_CHAIN_KEY]: chain });
  } catch {}
}

export async function clearLinkjustChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(LINKJUST_CHAIN_KEY);
  } catch {}
}

export function rememberLinkjustAlias(alias: string): void {
  try {
    sessionStorage.setItem(LINKJUST_ALIAS_KEY, alias);
  } catch {}
}

function aliasFromSession(): string | null {
  try {
    return sessionStorage.getItem(LINKJUST_ALIAS_KEY);
  } catch {
    return null;
  }
}

function aliasFromReferrer(): string | null {
  const ref = document.referrer?.trim();
  if (!ref || !/^https?:\/\//i.test(ref)) return null;
  return articleAliasFromUrl(ref) ?? (isLinkjustReferer(ref) ? linkjustAliasFromUrl(ref) : null);
}

export function chainIsStale(chain: LinkjustChain): boolean {
  if (!chain.startedAt) return false;
  return Date.now() - chain.startedAt > CHAIN_STALE_MS;
}

export function chainNeedsReset(chain: LinkjustChain, alias: string): boolean {
  if (!chain.alias || chain.alias !== alias) return true;
  return chainIsStale(chain);
}

export function resolveLinkjustAliasSync(chain: LinkjustChain | null): string | null {
  const html = document.documentElement?.innerHTML ?? '';
  return (
    linkjustAliasFromUrl(location.href) ??
    articleAliasFromUrl(location.href) ??
    articleAliasFromHtml(html) ??
    chain?.alias ??
    aliasFromReferrer() ??
    aliasFromSession()
  );
}

export async function resolveLinkjustAlias(chain: LinkjustChain): Promise<string | null> {
  return resolveLinkjustAliasSync(chain);
}

export function markArticleVisited(chain: LinkjustChain, href: string = location.href): LinkjustChain {
  const path = normArticlePath(href);
  if (!path) return chain;
  const visitedPaths = chain.visitedPaths.includes(path) ? chain.visitedPaths : [...chain.visitedPaths, path];
  return { ...chain, visitedPaths, hopCount: chain.hopCount + (chain.visitedPaths.includes(path) ? 0 : 1) };
}

export function shouldReturnToShortener(chain: LinkjustChain, hop: { kind: string; url: string } | null): boolean {
  if (hop?.kind === 'shortener') return true;
  if (chain.hopCount >= LOOP_RETURN_HOPS) return true;
  if (!hop || hop.kind !== 'article') return chain.hopCount > 0;
  try {
    const path = normArticlePath(hop.url);
    return Boolean(path && chain.visitedPaths.includes(path));
  } catch {
    return false;
  }
}

export function shortenerUnlockUrl(chain: LinkjustChain): string | null {
  if (!chain.alias) return null;
  const host = chain.shortenerHost ?? 'linkjust.com';
  return linkjustUrl(chain.alias, host);
}
