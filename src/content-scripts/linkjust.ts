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
import { createBypassOverlay, type BypassOverlayCopy } from '../injected-ui/overlay';

const {
  readOverlaySession: readLinkjustOverlaySession,
  clearOverlaySession: clearLinkjustOverlaySession,
  restoreOverlayFromSession: restoreLinkjustOverlayFromSession,
  mountOverlay: mountLinkjustOverlay,
} = createBypassOverlay({
  id: 'skip-wait-linkjust-overlay',
  activeClass: 'sw-linkjust-active',
  sessionKey: 'sw-linkjust-overlay',
  brand: 'Skip Wait · Linkjust',
  countdownLabel: 'seconds left on timer',
});

type OverlayCopy = BypassOverlayCopy;
import { dismissLinkjustAdblockOverlay, nudgeLinkjustTimerUi } from './linkjust/timer-ui';
import { finishLinkjustUnlock, isLinkjustUnlockPage } from './linkjust/unlock';

const COPY = {
  entry: {
    title: 'Step 1 · Opening verification',
    detail: 'Loading the Linkjust article page.',
  },
  article: {
    title: 'Step 2 · Skipping article timer',
    detail: 'Following the Linkjust article chain.',
  },
  unlock: {
    title: 'Step 3 · Unlocking your link',
    detail: 'Fetching your URL from Linkjust.',
  },
  destination: {
    title: 'Done · Opening your link',
    detail: 'Redirecting to your destination now.',
  },
  failed: {
    title: 'Could not finish',
    detail: 'Reload the Linkjust short link and try again.',
  },
} as const;

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
let overlay: ReturnType<typeof mountLinkjustOverlay> | null = restoreLinkjustOverlayFromSession();

function isLinkjustRootHost(): boolean {
  return isLinkjustHost() && isAllowedHost(linkjustRoots()) && !!linkjustAliasFromUrl(location.href);
}

function requestVisibilitySpoof(): void {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
}

function ensureOverlay(copy: OverlayCopy): void {
  overlay ??= mountLinkjustOverlay();
  overlay.setPhase(copy.title, copy.detail);
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

function go(url: string, copy: OverlayCopy): void {
  navigating = true;
  ensureOverlay(copy);
  window.location.replace(url);
}

function goDestination(url: string): void {
  if (navigating) return;
  navigating = true;
  ensureOverlay(COPY.destination);
  void clearLinkjustChain();
  clearLinkjustOverlaySession();
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

function goShortenerUnlock(copy: OverlayCopy = COPY.unlock): void {
  const url = shortenerUnlockUrl(cachedChain);
  if (!url) return;
  go(url, copy);
}

function followHop(hop: NonNullable<ReturnType<typeof extractLinkjustHop>>): void {
  const alias = resolveAlias();
  if (alias) {
    cachedChain = chainPayload(alias, cachedChain);
    void writeLinkjustChain(cachedChain);
  }

  if (hop.kind === 'shortener') {
    go(hop.url, COPY.unlock);
    return;
  }

  if (hop.kind === 'destination' && isFinalHop(hop.url)) {
    goDestination(hop.url);
    return;
  }

  void syncChain((chain) => markArticleVisited(chain)).then(() => {
    go(hop.url, COPY.article);
  });
}

function runHopLoop(): void {
  if (hopLoopRunning || navigating) return;
  hopLoopRunning = true;
  ensureOverlay(COPY.article);

  let done = false;
  const tryGo = (): boolean => {
    if (done || navigating) return true;

    const hop = pickHop();
    if (shouldReturnToShortener(cachedChain, hop)) {
      done = true;
      goShortenerUnlock(COPY.article);
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
  ensureOverlay(COPY.unlock);
  requestVisibilitySpoof();
  const ui = overlay ?? mountLinkjustOverlay();
  const dest = await finishLinkjustUnlock(location.href, (sec) => ui.startCountdown(sec));
  if (dest) {
    goDestination(dest);
    return;
  }
  ui.setError(COPY.failed.detail);
}

async function runLinkjustShortenerFlow(): Promise<void> {
  const alias = linkjustAliasFromUrl(location.href);
  if (!alias) return;

  ensureOverlay(isLinkjustUnlockPage() ? COPY.unlock : COPY.entry);

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
    go(hop, COPY.entry);
    return;
  }

  overlay?.setError(COPY.failed.detail);
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

function bootOverlay(): void {
  if (readLinkjustOverlaySession()) {
    overlay = restoreLinkjustOverlayFromSession();
    return;
  }
  if (isLinkjustRootHost()) {
    ensureOverlay(isLinkjustUnlockPage() ? COPY.unlock : COPY.entry);
    return;
  }
  if (isLinkjustMediatorShell()) ensureOverlay(COPY.article);
}

export function initLinkjust(): void {
  if (window !== window.top) return;

  if (isLinkjustRootHost() || isLinkjustMediatorShell() || readLinkjustOverlaySession()) {
    bootOverlay();
    requestVisibilitySpoof();
  }

  void readLinkjustChain().then((chain) => {
    cachedChain = chain;
    if (chain.alias && isLinkjustMediatorShell()) {
      bootOverlay();
      requestVisibilitySpoof();
    }
  });

  const start = (): void => {
    void runFlow();
  };

  whenDomParsed(start);
  if (document.readyState !== 'loading') start();
}
