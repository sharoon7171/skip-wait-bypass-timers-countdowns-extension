import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
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
} from '../cut4money/cut4money-chain';
import {
  DEFAULT_SHORTENER_HOSTS,
  isShortenerHost,
  isShortenerPleaseWait,
  isShortenerReferer,
  shortenerAliasFromUrl,
  shortenerUrl,
} from '../cut4money/hosts';
import {
  aliasFromMediatorQuery,
  isMediatorShell,
  shortenerAliasFromHtml,
} from '../cut4money/mediator';
import {
  clearOverlaySession,
  mountCut4MoneyOverlay,
  persistOverlaySession,
  readOverlaySession,
  restoreOverlayFromSession,
  type Cut4MoneyOverlay,
} from '../cut4money/overlay';
import {
  fetchShortenerFirstHop,
  finishV2linksInterstitial,
  isV2linksInterstitial,
} from '../cut4money/v2links-api';

const REMOTE_DOMAINS_KEY = 'cut4money-bypass';

const COPY = {
  start: {
    title: 'Starting automated bypass',
    detail: 'Opening the verification page. Please wait — no clicks needed.',
  },
  mediator: {
    title: 'Step 1 of 2 · Verification',
    detail: 'Confirming the article page, then continuing automatically.',
  },
  returnShortener: {
    title: 'Step 2 of 2 · Link unlock',
    detail: 'Returning to the short link to fetch your file.',
  },
  unlock: {
    title: 'Step 2 of 2 · Preparing download',
    detail: 'Getting your link. This runs automatically.',
  },
  destination: {
    title: 'Almost there',
    detail: 'Opening your download page now.',
  },
  needArticle: {
    title: 'Waiting for verification',
    detail: 'Complete the article step first, then open the short link again.',
  },
  unlockFailed: {
    title: 'Could not get your link',
    detail: 'Reload the short-link tab or start again from the original URL.',
  },
  startFailed: {
    title: 'Could not start bypass',
    detail: 'Reload the short-link tab and try again.',
  },
} as const;

let flowRunning = false;
let navigating = false;

function shortenerHosts(): string[] {
  return [...new Set([...DEFAULT_SHORTENER_HOSTS, ...getHostsByKey(REMOTE_DOMAINS_KEY)])];
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
  return restoreOverlayFromSession() ?? mountCut4MoneyOverlay();
}

function show(ui: Cut4MoneyOverlay, title: string, detail: string): void {
  ui.setPhase(title, detail);
}

function navigate(url: string, title: string, detail: string): void {
  navigating = true;
  persistOverlaySession({ title, detail });
  show(ui(), title, detail);
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
  const ref = document.referrer?.trim();
  if (ref && /^https?:\/\//i.test(ref) && !isShortenerReferer(ref)) return ref;
  if (chain.lastArticleUrl) return chain.lastArticleUrl;
  return (await readPendingUnlock())?.referer ?? null;
}

function openDestination(url: string): void {
  if (navigating) return;
  navigating = true;
  show(ui(), COPY.destination.title, COPY.destination.detail);
  void writePendingUnlock(null);
  void clearCut4MoneyChain();
  clearOverlaySession();
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
  navigate(
    shortenerUrl(alias, host),
    COPY.returnShortener.title,
    COPY.returnShortener.detail,
  );
}

async function redirectToMediator(
  alias: string,
  host: string,
  overlay: Cut4MoneyOverlay,
): Promise<boolean> {
  show(overlay, COPY.start.title, COPY.start.detail);
  const hop = await fetchShortenerFirstHop(alias, host);
  if (!hop) {
    show(overlay, COPY.startFailed.title, COPY.startFailed.detail);
    return false;
  }
  navigate(hop, COPY.start.title, COPY.start.detail);
  return true;
}

async function runMediatorFlow(chain: Cut4MoneyChain, alias: string): Promise<void> {
  requestVisibilitySpoof();
  const overlay = ui();
  show(overlay, COPY.mediator.title, COPY.mediator.detail);
  const articleUrl = location.href.split('#')[0] ?? location.href;
  goToShortenerUnlock(alias, chain, articleUrl);
}

async function runUnlockVisit(alias: string, chain: Cut4MoneyChain): Promise<void> {
  const overlay = ui();
  const referer = await refererForUnlock(chain);
  if (!referer) {
    show(overlay, COPY.needArticle.title, COPY.needArticle.detail);
    return;
  }

  if (!isV2linksInterstitial()) {
    goToShortenerUnlock(alias, chain, referer);
    return;
  }

  show(overlay, COPY.unlock.title, COPY.unlock.detail);
  const dest = await finishV2linksInterstitial(location.href, (sec) =>
    overlay.startCountdown(sec),
  );
  if (dest) {
    openDestination(dest);
    return;
  }
  show(overlay, COPY.unlockFailed.title, COPY.unlockFailed.detail);
}

async function runShortenerFlow(): Promise<void> {
  const alias = shortenerAliasFromUrl(location.href);
  if (!alias) return;

  const host = location.hostname.replace(/^www\./i, '');
  const overlay = ui();
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

  if (isV2linksInterstitial()) {
    await runUnlockVisit(alias, chain);
    return;
  }

  if (chain.phase === 'unlock') {
    await runUnlockVisit(alias, chain);
    return;
  }

  const html = document.documentElement?.innerHTML ?? '';
  if (isShortenerPleaseWait(html) || chain.phase === 'mediators') {
    await redirectToMediator(alias, shortenerHostFrom(chain), overlay);
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
  if (aliasOnShortener || isMediatorShell() || readOverlaySession()) {
    restoreOverlayFromSession();
    requestVisibilitySpoof();
  }

  if (aliasOnShortener) {
    const alias = shortenerAliasFromUrl(location.href)!;
    const host = location.hostname.replace(/^www\./i, '');
    void writeCut4MoneyChain(
      chainPayload(alias, null, { phase: 'mediators', lastArticleUrl: null }, host),
    );
    rememberAlias(alias);
    if (!readOverlaySession()) {
      persistOverlaySession(COPY.start);
      mountCut4MoneyOverlay().setPhase(COPY.start.title, COPY.start.detail);
    }
  }

  const start = (): void => {
    void runFlow().catch(() => {});
  };

  whenDomParsed(start);
  if (document.readyState !== 'loading') start();
}
