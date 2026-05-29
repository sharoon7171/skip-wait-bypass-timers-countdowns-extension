import { shortenerAliasFromUrl } from './hosts';

export const CUT4MONEY_CHAIN_KEY = 'sw-cut4money-chain' as const;
export const CUT4MONEY_PENDING_UNLOCK_KEY = 'sw-cut4money-pending-unlock' as const;
export const CUT4MONEY_ALIAS_KEY = 'sw-cut4money-alias' as const;
export const CHAIN_STALE_MS = 30 * 60 * 1000;

export type Cut4MoneyPhase = 'idle' | 'mediators' | 'unlock';

export type Cut4MoneyPendingUnlock = {
  alias: string;
  referer: string | null;
  at: number;
};

export type Cut4MoneyChain = {
  alias: string | null;
  phase: Cut4MoneyPhase;
  lastArticleUrl: string | null;
  shortenerHost: string | null;
  startedAt: number;
};

export const EMPTY_CUT4MONEY_CHAIN: Cut4MoneyChain = {
  alias: null,
  phase: 'idle',
  lastArticleUrl: null,
  shortenerHost: null,
  startedAt: 0,
};

function storageReady(): boolean {
  try {
    return Boolean(chrome?.runtime?.id && chrome.storage?.local);
  } catch {
    return false;
  }
}

export async function readCut4MoneyChain(): Promise<Cut4MoneyChain> {
  if (!storageReady()) return { ...EMPTY_CUT4MONEY_CHAIN };
  try {
    const data = await chrome.storage.local.get(CUT4MONEY_CHAIN_KEY);
    const raw = data[CUT4MONEY_CHAIN_KEY] as Partial<Cut4MoneyChain> | undefined;
    if (!raw || typeof raw !== 'object') return { ...EMPTY_CUT4MONEY_CHAIN };
    const phase =
      raw.phase === 'unlock' || raw.phase === 'mediators' ? raw.phase : 'idle';
    return {
      alias: typeof raw.alias === 'string' ? raw.alias : null,
      phase,
      lastArticleUrl:
        typeof raw.lastArticleUrl === 'string' ? raw.lastArticleUrl : null,
      shortenerHost:
        typeof raw.shortenerHost === 'string' ? raw.shortenerHost : null,
      startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0,
    };
  } catch {
    return { ...EMPTY_CUT4MONEY_CHAIN };
  }
}

export async function writeCut4MoneyChain(chain: Cut4MoneyChain): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.set({ [CUT4MONEY_CHAIN_KEY]: chain });
  } catch {}
}

export async function clearCut4MoneyChain(): Promise<void> {
  if (!storageReady()) return;
  try {
    await chrome.storage.local.remove(CUT4MONEY_CHAIN_KEY);
  } catch {}
}

export function chainIsStale(chain: Cut4MoneyChain): boolean {
  if (!chain.startedAt) return false;
  return Date.now() - chain.startedAt > CHAIN_STALE_MS;
}

export async function readPendingUnlock(): Promise<Cut4MoneyPendingUnlock | null> {
  if (!storageReady()) return null;
  try {
    const data = await chrome.storage.local.get(CUT4MONEY_PENDING_UNLOCK_KEY);
    const raw = data[CUT4MONEY_PENDING_UNLOCK_KEY] as
      | Partial<Cut4MoneyPendingUnlock>
      | undefined;
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
  pending: Cut4MoneyPendingUnlock | null,
): Promise<void> {
  if (!storageReady()) return;
  try {
    if (!pending) {
      await chrome.storage.local.remove(CUT4MONEY_PENDING_UNLOCK_KEY);
      return;
    }
    await chrome.storage.local.set({ [CUT4MONEY_PENDING_UNLOCK_KEY]: pending });
  } catch {}
}

export function chainNeedsReset(chain: Cut4MoneyChain, alias: string): boolean {
  if (chain.phase === 'unlock' && chain.alias === alias) return false;
  if (!chain.alias || chain.alias !== alias) return true;
  if (chainIsStale(chain)) return true;
  return false;
}

export function aliasFromReferrer(): string | null {
  return shortenerAliasFromUrl(document.referrer);
}
