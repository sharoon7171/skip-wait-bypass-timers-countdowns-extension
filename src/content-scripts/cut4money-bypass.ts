import { createBypassOverlay, type BypassOverlay } from '../injected-ui/overlay';

const {
  readOverlaySession: readCut4MoneyOverlaySession,
  persistOverlaySession: persistCut4MoneyOverlaySession,
  clearOverlaySession: clearCut4MoneyOverlaySession,
  restoreOverlayFromSession: restoreCut4MoneyOverlayFromSession,
  mountOverlay: mountCut4MoneyOverlay,
} = createBypassOverlay({
  id: 'skip-wait-cut4money-overlay',
  activeClass: 'sw-cut4money-active',
  sessionKey: 'sw-cut4money-overlay',
  brand: 'Skip Wait',
});

type Cut4MoneyOverlay = BypassOverlay;
import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import {
  CUT4MONEY_ALIAS_KEY,
  EMPTY_CUT4MONEY_CHAIN,
  aliasFromReferrer,
  chainNeedsReset,
  clearCut4MoneyChain,
  readCut4MoneyChain,
  readPendingUnlock,
  writeCut4MoneyChain,
  writePendingUnlock,
  type Cut4MoneyChain,
} from './cut4money/chain';
import {
  DEFAULT_SHORTENER_HOSTS,
  isShortenerHost,
  isShortenerPleaseWait,
  shortenerAliasFromUrl,
  shortenerUrl,
} from './cut4money/hosts';
import {
  fetchShortenerFirstHop,
  finishV2linksInterstitial,
  isShortenerContinuePage,
  isV2linksInterstitial,
} from './cut4money/links-api';
import {
  aliasFromMediatorQuery,
  isMediatorShell,
  shortenerAliasFromHtml,
} from './cut4money/mediator';

const COPY = {
  working: {
    title: 'Skip Wait',
    detail: 'Bypassing this short link…',
  },
  hop: {
    title: 'Opening verification',
    detail: 'Loading the article page. No clicks needed.',
  },
  returnShortener: {
    title: 'Returning to short link',
    detail: 'Verification recorded. Unlocking your link next.',
  },
  unlock: {
    title: 'Unlocking your link',
    detail: 'Fetching your destination URL.',
  },
  unlockStep: {
    title: 'Step 2 · Unlocking your link',
    detail: 'Fetching your destination URL.',
  },
  destination: {
    title: 'Opening your link',
    detail: 'Redirecting to your destination now.',
  },
  needArticle: {
    title: 'Start from the short link',
    detail: 'Open the short-link URL again so Skip Wait can finish the flow.',
  },
  unlockFailed: {
    title: 'Could not get your link',
    detail: 'Reload this tab or open the short link again.',
  },
  startFailed: {
    title: 'Could not start',
    detail: 'Reload this tab and try again.',
  },
} as const;

let flowRunning = false;
let navigating = false;

function shortenerHosts(): readonly string[] {
  return DEFAULT_SHORTENER_HOSTS;
}

function isShortenerRootHost(): boolean {
  return isShortenerHost() && isAllowedHost(shortenerHosts());
}

function shortenerHostFrom(chain: Cut4MoneyChain): string {
  if (isShortenerHost()) return location.hostname.replace(/^www\./i, '');
  return chain.shortenerHost ?? DEFAULT_SHORTENER_HOSTS[0];
}

export function isCut4MoneyBypassHost(): boolean {
  if (window !== window.top) return false;
  try {
    if (isShortenerRootHost()) return true;
    return isMediatorShell();
  } catch {
    return false;
  }
}

function requestVisibilitySpoof(): void {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
}

function chainPayload(
  alias: string,
  chain: Cut4MoneyChain | null,
  fields: Pick<Cut4MoneyChain, 'phase' | 'lastArticleUrl'>,
  shortenerHost?: string,
): Cut4MoneyChain {
  const host =
    shortenerHost ??
    chain?.shortenerHost ??
    (isShortenerHost() ? location.hostname.replace(/^www\./i, '') : null);
  return {
    alias,
    phase: fields.phase,
    lastArticleUrl: fields.lastArticleUrl ?? chain?.lastArticleUrl ?? null,
    shortenerHost: host,
    startedAt: chain?.startedAt || Date.now(),
  };
}

function rememberAlias(alias: string): void {
  try {
    sessionStorage.setItem(CUT4MONEY_ALIAS_KEY, alias);
  } catch {}
}

function ui(): Cut4MoneyOverlay {
  return restoreCut4MoneyOverlayFromSession() ?? mountCut4MoneyOverlay();
}

function show(overlay: Cut4MoneyOverlay, copy: { title: string; detail: string }): void {
  overlay.setPhase(copy.title, copy.detail);
}

function navigate(url: string, copy: { title: string; detail: string }): void {
  navigating = true;
  persistCut4MoneyOverlaySession(copy);
  show(ui(), copy);
  window.location.replace(url);
}

async function resolveAlias(chain: Cut4MoneyChain): Promise<string | null> {
  return (
    shortenerAliasFromUrl(location.href) ??
    aliasFromMediatorQuery() ??
    chain.alias ??
    shortenerAliasFromHtml() ??
    aliasFromReferrer() ??
    (await readPendingUnlock())?.alias ??
    (() => {
      try {
        return sessionStorage.getItem(CUT4MONEY_ALIAS_KEY);
      } catch {
        return null;
      }
    })()
  );
}

async function refererForUnlock(chain: Cut4MoneyChain): Promise<string | null> {
  if (chain.lastArticleUrl) return chain.lastArticleUrl;
  return (await readPendingUnlock())?.referer ?? null;
}

function shouldUnlock(chain: Cut4MoneyChain, html: string): boolean {
  return (
    isV2linksInterstitial(html) ||
    isShortenerContinuePage(html) ||
    chain.phase === 'unlock'
  );
}

function openDestination(url: string): void {
  if (navigating) return;
  navigating = true;
  show(ui(), COPY.destination);
  void writePendingUnlock(null);
  void clearCut4MoneyChain();
  clearCut4MoneyOverlaySession();
  window.location.replace(url);
}

function goToShortenerUnlock(
  alias: string,
  chain: Cut4MoneyChain,
  articleUrl: string,
): void {
  const host = shortenerHostFrom(chain);
  void writePendingUnlock({ alias, referer: articleUrl, at: Date.now() });
  void writeCut4MoneyChain(
    chainPayload(alias, chain, { phase: 'unlock', lastArticleUrl: articleUrl }, host),
  );
  navigate(shortenerUrl(alias, host), COPY.returnShortener);
}

async function runMediatorFlow(chain: Cut4MoneyChain, alias: string): Promise<void> {
  requestVisibilitySpoof();
  const articleUrl = location.href.split('#')[0] ?? location.href;
  goToShortenerUnlock(alias, chain, articleUrl);
}

async function runUnlockVisit(alias: string, chain: Cut4MoneyChain): Promise<void> {
  const overlay = ui();
  const html = document.documentElement?.innerHTML ?? '';
  const selfContained = isShortenerContinuePage(html);
  const onUnlockPage = isV2linksInterstitial(html);
  const referer = await refererForUnlock(chain);

  if (!onUnlockPage && !selfContained && !referer) {
    show(overlay, COPY.needArticle);
    return;
  }

  if (!onUnlockPage && !selfContained) {
    goToShortenerUnlock(alias, chain, referer!);
    return;
  }

  show(overlay, selfContained ? COPY.unlock : COPY.unlockStep);
  const dest = await finishV2linksInterstitial(location.href, (sec) =>
    overlay.startCountdown(sec),
  );
  if (dest) {
    openDestination(dest);
    return;
  }
  show(overlay, COPY.unlockFailed);
}

async function syncChain(alias: string, host: string): Promise<Cut4MoneyChain> {
  let chain = await readCut4MoneyChain();
  if (chainNeedsReset(chain, alias)) {
    await writePendingUnlock(null);
    await clearCut4MoneyChain();
    chain = { ...EMPTY_CUT4MONEY_CHAIN };
  }
  if (!chain.alias || chain.alias !== alias) {
    await writeCut4MoneyChain(
      chainPayload(alias, null, { phase: 'mediators', lastArticleUrl: null }, host),
    );
    rememberAlias(alias);
    chain = await readCut4MoneyChain();
  }
  return chain;
}

async function runShortenerFlow(): Promise<void> {
  const alias = shortenerAliasFromUrl(location.href);
  if (!alias) return;

  const host = location.hostname.replace(/^www\./i, '');
  const overlay = ui();
  const chain = await syncChain(alias, host);
  const html = document.documentElement?.innerHTML ?? '';

  if (shouldUnlock(chain, html)) {
    await runUnlockVisit(alias, chain);
    return;
  }

  const hop = await fetchShortenerFirstHop(alias, shortenerHostFrom(chain));
  if (hop && !/t\.co/i.test(hop)) {
    navigate(hop, COPY.hop);
    return;
  }

  if (isShortenerPleaseWait(html) || chain.phase === 'mediators') {
    show(overlay, COPY.startFailed);
  }
}

async function runFlow(): Promise<void> {
  if (flowRunning || navigating) return;
  if (!isCut4MoneyBypassHost()) return;

  flowRunning = true;
  try {
    const aliasOnShortener = shortenerAliasFromUrl(location.href);
    if (aliasOnShortener) {
      await runShortenerFlow();
      return;
    }
    if (!isMediatorShell()) return;

    const chain = await readCut4MoneyChain();
    const alias = await resolveAlias(chain);
    if (!alias) return;

    await runMediatorFlow(chain, alias);
  } finally {
    flowRunning = false;
  }
}

export function initCut4MoneyBypass(): void {
  if (window !== window.top) return;

  const aliasOnShortener =
    isShortenerRootHost() && shortenerAliasFromUrl(location.href);
  if (aliasOnShortener || isMediatorShell() || readCut4MoneyOverlaySession()) {
    restoreCut4MoneyOverlayFromSession();
    requestVisibilitySpoof();
  }

  if (aliasOnShortener && !readCut4MoneyOverlaySession()) {
    persistCut4MoneyOverlaySession(COPY.working);
    mountCut4MoneyOverlay().setPhase(COPY.working.title, COPY.working.detail);
  }

  const start = (): void => {
    void runFlow().catch(() => {});
  };

  whenDomParsed(start);
  if (document.readyState !== 'loading') start();
}
