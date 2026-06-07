import { isExtensionEnabledSync } from '../utils/extension-enabled';
import {
  chainNeedsReset,
  readCut4MoneyChain,
  readPendingUnlock,
  writeCut4MoneyChain,
  type Cut4MoneyChain,
} from '../content-scripts/cut4money/chain';
import { shortenerAliasFromUrl } from '../content-scripts/cut4money/hosts';
import { fetchShortenerFirstHop } from '../content-scripts/cut4money/links-api';

const skipTabIds = new Set<number>();
const inflight = new Map<string, Promise<string | null>>();

function mediatorsChain(alias: string, shortenerHost: string): Cut4MoneyChain {
  return {
    alias,
    phase: 'mediators',
    lastArticleUrl: null,
    shortenerHost,
    startedAt: Date.now(),
  };
}

function hopKey(alias: string, host: string): string {
  return `${host}/${alias}`;
}

function firstHop(alias: string, host: string): Promise<string | null> {
  const key = hopKey(alias, host);
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = fetchShortenerFirstHop(alias, host).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function shouldHijack(alias: string): Promise<boolean> {
  const pending = await readPendingUnlock();
  if (pending?.alias === alias && pending.referer) return false;

  const chain = await readCut4MoneyChain();
  if (chain.phase === 'unlock' && chain.alias === alias) return false;
  if (chainNeedsReset(chain, alias)) return true;
  return chain.phase !== 'unlock';
}

export function initCut4MoneyShr2Hop(): void {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    if (!isExtensionEnabledSync()) return;
    if (skipTabIds.delete(details.tabId)) return;

    const alias = shortenerAliasFromUrl(details.url);
    if (!alias) return;

    const shortenerHost = new URL(details.url).hostname.replace(/^www\./i, '');

    void (async () => {
      if (!(await shouldHijack(alias))) return;
      await writeCut4MoneyChain(mediatorsChain(alias, shortenerHost));

      const hop = await firstHop(alias, shortenerHost);
      if (!hop || /t\.co/i.test(hop)) return;

      skipTabIds.add(details.tabId);
      try {
        await chrome.tabs.update(details.tabId, { url: hop });
      } catch {
        skipTabIds.delete(details.tabId);
      }
    })();
  });
}
