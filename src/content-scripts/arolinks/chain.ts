export const AROLINKS_CHAIN_KEY = 'sw-arolinks-chain' as const;
export const ARO_PENDING_UNLOCK_KEY = 'sw-aro-pending-unlock' as const;
export const ARO_ALIAS_KEY = 'sw-aro-alias' as const;

export type ArolinksPendingUnlock = {
  alias: string;
  referer: string | null;
  at: number;
};

export const MIN_MEDIATOR_HOPS = 3;
export const MAX_MEDIATOR_HOPS = 6;
export const CHAIN_STALE_MS = 30 * 60 * 1000;

export type ArolinksPhase = 'idle' | 'mediators' | 'unlock';

export type ArolinksChain = {
  alias: string | null;
  phase: ArolinksPhase;
  hops: number;
  lastArticleUrl: string | null;
  unlockRestarts: number;
  startedAt: number;
};

export const EMPTY_AROLINKS_CHAIN: ArolinksChain = {
  alias: null,
  phase: 'idle',
  hops: 0,
  lastArticleUrl: null,
  unlockRestarts: 0,
  startedAt: 0,
};

export function arolinksAliasFromLocation(href: string): string | null {
  try {
    const u = new URL(href);
    if (!u.hostname.includes('arolinks.com')) return null;
    const seg = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (!seg || seg.length < 4) return null;
    if (['links', 'auth', 'pages', 'api'].includes(seg)) return null;
    return seg;
  } catch {
    return null;
  }
}

function storageReady(): boolean {
  try {
    return Boolean(chrome?.runtime?.id && chrome.storage?.local);
  } catch {
    return false;
  }
}

export async function readArolinksChain(): Promise<ArolinksChain> {
  if (!storageReady()) return { ...EMPTY_AROLINKS_CHAIN };
  try {
    const data = await chrome.storage.local.get(AROLINKS_CHAIN_KEY);
    const raw = data[AROLINKS_CHAIN_KEY] as Partial<ArolinksChain> | undefined;
    if (!raw || typeof raw !== 'object') return { ...EMPTY_AROLINKS_CHAIN };
    const phase =
      raw.phase === 'unlock' || raw.phase === 'mediators' ? raw.phase : 'idle';
    return {
      alias: typeof raw.alias === 'string' ? raw.alias : null,
      phase,
      hops: typeof raw.hops === 'number' ? Math.max(0, raw.hops) : 0,
      lastArticleUrl:
        typeof raw.lastArticleUrl === 'string' ? raw.lastArticleUrl : null,
      unlockRestarts:
        typeof raw.unlockRestarts === 'number' ? Math.max(0, raw.unlockRestarts) : 0,
      startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    };
  } catch {
    return { ...EMPTY_AROLINKS_CHAIN };
  }
}

export async function writeArolinksChain(chain: ArolinksChain): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.set({ [AROLINKS_CHAIN_KEY]: chain });
  } catch {}
}

export async function clearArolinksChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(AROLINKS_CHAIN_KEY);
  } catch {}
}

export function chainIsStale(chain: ArolinksChain): boolean {
  if (!chain.startedAt) return false;
  return Date.now() - chain.startedAt > CHAIN_STALE_MS;
}

export async function readPendingUnlock(): Promise<ArolinksPendingUnlock | null> {
  if (!storageReady()) return null;
  try {
    const data = await chrome.storage.local.get(ARO_PENDING_UNLOCK_KEY);
    const raw = data[ARO_PENDING_UNLOCK_KEY] as Partial<ArolinksPendingUnlock> | undefined;
    if (!raw || typeof raw !== 'object' || typeof raw.alias !== 'string') return null;
    return {
      alias: raw.alias,
      referer: typeof raw.referer === 'string' ? raw.referer : null,
      at: typeof raw.at === 'number' ? raw.at : 0,
    };
  } catch {
    return null;
  }
}

export async function writePendingUnlock(
  pending: ArolinksPendingUnlock | null,
): Promise<void> {
  if (!storageReady()) return;
  try {
    if (!pending) {
      await chrome.storage.local.remove(ARO_PENDING_UNLOCK_KEY);
      return;
    }
    await chrome.storage.local.set({ [ARO_PENDING_UNLOCK_KEY]: pending });
  } catch {}
}

export function chainNeedsReset(chain: ArolinksChain, alias: string): boolean {
  if (chain.phase === 'unlock' && chain.alias === alias) return false;
  if (!chain.alias || chain.alias !== alias) return true;
  if (chain.hops > MAX_MEDIATOR_HOPS) return true;
  if (chainIsStale(chain)) return true;
  return false;
}
