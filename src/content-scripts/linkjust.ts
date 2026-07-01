import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { extractLinkjustHop, isFinalHop } from './linkjust/extract-hop';
import {
  destinationFromLinkjustApiUrl,
  fetchLinkjustFirstHop,
  isLinkjustHost,
  linkjustAliasFromUrl,
  linkjustRoots,
} from './linkjust/hosts';
import {
  chainNeedsReset,
  clearLinkjustChain,
  EMPTY_LINKJUST_CHAIN,
  markArticleVisited,
  readLinkjustChain,
  rememberLinkjustAlias,
  resolveLinkjustAliasSync,
  shouldReturnToShortener,
  shortenerUnlockUrl,
  writeLinkjustChain,
  type LinkjustChain,
} from './linkjust/chain';
import { isLinkjustMediatorShell } from './linkjust/mediator';
import { dismissLinkjustAdblockOverlay, nudgeLinkjustTimerUi } from './linkjust/timer-ui';
import { finishLinkjustUnlock, isLinkjustUnlockPage } from './linkjust/unlock';

const OBS_HOP: MutationObserverInit = {
  attributeFilter: ['href', 'style', 'class', 'disabled'],
  attributes: true,
  childList: true,
  subtree: true,
};

let flowRunning = false;
let navigating = false;
let hopLoopRunning = false;
let cachedChain: LinkjustChain = { ...EMPTY_LINKJUST_CHAIN };

function isLinkjustRootHost(): boolean {
  return isLinkjustHost() && isAllowedHost(linkjustRoots()) && !!linkjustAliasFromUrl(location.href);
}

function requestVisibilitySpoof(): void {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
}

function chainPayload(alias: string, chain: LinkjustChain | null): LinkjustChain {
  return {
    alias,
    shortenerHost:
      chain?.shortenerHost ??
      (isLinkjustHost() ? location.hostname.replace(/^www\./i, '') : null) ??
      linkjustRoots()[0] ??
      'linkjust.com',
    startedAt: chain?.startedAt || Date.now(),
    visitedPaths: chain?.visitedPaths ?? [],
    hopCount: chain?.hopCount ?? 0,
  };
}

function go(url: string): void {
  navigating = true;
  window.location.replace(url);
}

function goDestination(url: string): void {
  if (navigating) return;
  navigating = true;
  void clearLinkjustChain();
  window.location.replace(url);
}

async function syncChain(update?: (chain: LinkjustChain) => LinkjustChain): Promise<LinkjustChain> {
  cachedChain = await readLinkjustChain();
  if (update) {
    cachedChain = update(cachedChain);
    await writeLinkjustChain(cachedChain);
  }
  return cachedChain;
}

function resolveAlias(): string | null {
  return resolveLinkjustAliasSync(cachedChain);
}

function pickHop() {
  const alias = resolveAlias();
  return extractLinkjustHop(alias, cachedChain.visitedPaths);
}

function goShortenerUnlock(): void {
  const url = shortenerUnlockUrl(cachedChain);
  if (!url) return;
  go(url);
}

function followHop(hop: NonNullable<ReturnType<typeof extractLinkjustHop>>): void {
  const alias = resolveAlias();
  if (alias) {
    cachedChain = chainPayload(alias, cachedChain);
    void writeLinkjustChain(cachedChain);
  }

  if (hop.kind === 'shortener') {
    go(hop.url);
    return;
  }

  if (hop.kind === 'destination' && isFinalHop(hop.url)) {
    goDestination(hop.url);
    return;
  }

  void syncChain((chain) => markArticleVisited(chain)).then(() => {
    go(hop.url);
  });
}

function runHopLoop(): void {
  if (hopLoopRunning || navigating) return;
  hopLoopRunning = true;

  let done = false;
  const tryGo = (): boolean => {
    if (done || navigating) return true;

    const hop = pickHop();
    if (shouldReturnToShortener(cachedChain, hop)) {
      done = true;
      goShortenerUnlock();
      return true;
    }
    if (!hop) return false;

    done = true;
    followHop(hop);
    return true;
  };

  const prep = (): void => {
    dismissLinkjustAdblockOverlay();
    if (!tryGo()) nudgeLinkjustTimerUi();
  };

  const observer = new MutationObserver(() => {
    prep();
    if (tryGo()) observer.disconnect();
  });

  requestVisibilitySpoof();
  prep();
  if (tryGo()) return;

  observer.observe(document.documentElement, OBS_HOP);
  let micro = 0;
  const microBurst = (): void => {
    if (done) return;
    prep();
    if (tryGo()) return void observer.disconnect();
    if (++micro < 64) queueMicrotask(microBurst);
  };
  queueMicrotask(microBurst);

  let frames = 0;
  const raf = (): void => {
    if (done) return;
    prep();
    if (tryGo()) return void observer.disconnect();
    if (++frames < 480) requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

async function runLinkjustUnlockFlow(): Promise<void> {
  requestVisibilitySpoof();
  const dest = await finishLinkjustUnlock(location.href);
  if (dest) {
    goDestination(dest);
  }
}

async function runLinkjustShortenerFlow(): Promise<void> {
  const alias = linkjustAliasFromUrl(location.href);
  if (!alias) return;

  const apiDest = destinationFromLinkjustApiUrl(location.href);
  if (apiDest) {
    goDestination(apiDest);
    return;
  }

  if (isLinkjustUnlockPage()) {
    await runLinkjustUnlockFlow();
    return;
  }

  await syncChain((chain) => {
    if (chainNeedsReset(chain, alias)) return chainPayload(alias, null);
    return chainPayload(alias, chain);
  });
  rememberLinkjustAlias(alias);

  const hop = await fetchLinkjustFirstHop(alias, cachedChain.shortenerHost ?? 'linkjust.com');
  if (hop) {
    go(hop);
  }
}

async function runLinkjustArticleFlow(): Promise<void> {
  await syncChain((chain) => markArticleVisited(chain));
  const alias = resolveAlias();
  if (alias && chainNeedsReset(cachedChain, alias)) {
    await syncChain(() => chainPayload(alias, null));
  } else if (alias) {
    cachedChain = chainPayload(alias, cachedChain);
    await writeLinkjustChain(cachedChain);
  }
  runHopLoop();
}

export function isLinkjustBypassHost(): boolean {
  if (window !== window.top) return false;
  try {
    if (isLinkjustRootHost()) return true;
    if (isLinkjustMediatorShell()) return true;
    return Boolean(cachedChain.alias && !isLinkjustHost());
  } catch {
    return false;
  }
}

async function runFlow(): Promise<void> {
  if (flowRunning || navigating) return;

  await syncChain();
  if (!isLinkjustRootHost() && !isLinkjustMediatorShell() && !cachedChain.alias) return;

  flowRunning = true;
  try {
    if (isLinkjustRootHost()) {
      await runLinkjustShortenerFlow();
      return;
    }
    if (isLinkjustMediatorShell() || cachedChain.alias) {
      await runLinkjustArticleFlow();
    }
  } finally {
    flowRunning = false;
  }
}

export function initLinkjust(): void {
  if (window !== window.top) return;

  if (isLinkjustRootHost() || isLinkjustMediatorShell()) {
    requestVisibilitySpoof();
  }

  void readLinkjustChain().then((chain) => {
    cachedChain = chain;
    if (chain.alias && isLinkjustMediatorShell()) {
      requestVisibilitySpoof();
    }
  });

  const start = (): void => {
    void runFlow();
  };

  whenDomParsed(start);
  if (document.readyState !== 'loading') start();
}
