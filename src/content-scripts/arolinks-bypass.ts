import { whenDomParsed } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import {
  ARO_ALIAS_KEY,
  EMPTY_AROLINKS_CHAIN,
  MIN_MEDIATOR_HOPS,
  arolinksAliasFromLocation,
  chainNeedsReset,
  clearArolinksChain,
  readArolinksChain,
  readPendingUnlock,
  writeArolinksChain,
  writePendingUnlock,
  type ArolinksChain,
} from '../shared/arolinks-chain';
import { MSG_ARO_GUARD_OFF, MSG_ARO_GUARD_ON } from '../shared/arolinks-guard-messages';
import {
  deltaUrlFromDom,
  deltaUrlFromHtml,
  fetchArolinksAliasPage,
  isArolinksPleaseWait,
  isArolinksTimerShell,
  jsRedirectTarget,
  linksGoFormFromHtml,
  pageHtml,
  postLinksGo,
  renderArolinksTimerPage,
  revealTimerLinks,
} from '../shared/arolinks-page';

const KEY = 'arolinks-bypass';
const LOCAL_HOSTS = ['arolinks.com', 'deltastudy.site'] as const;
const OVERLAY_ID = 'skip-wait-arolinks-overlay';
const PAGE_LOCK_ID = 'skip-wait-arolinks-page-lock';
const PAGE_BLOCK_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'wheel',
  'keydown',
  'contextmenu',
] as const;
const ARO_FIRST_REDIRECT_KEY = 'sw-aro-first-redirect';
const BYPASS_COOKIES = [
  { name: 'adcadg', value: 'insurance,online_colleges,study_abroad,finance,loan' },
  { name: 'eonstudb', value: 'insurance,online_colleges,study_abroad,finance,loan' },
] as const;
const LANDING_MAX = 9000;
const ARTICLE_MIN = 35_000;
const LANDING_POLL_MS = 2500;
const VERIFY_WAIT_SEC = 10;
const VERIFY_WAIT_MS = VERIFY_WAIT_SEC * 1000;
const UNLOCK_BURST_MS = 12_000;
const UNLOCK_TICK_MS = 150;

let flowRunning = false;
let navigating = false;
let linksGoPosted = false;
let lastFlowKey = '';
let unlockVisitActive = false;

type Overlay = {
  setPhase: (title: string, detail: string) => void;
  setDetail: (detail: string) => void;
  startCountdown: (seconds: number, detail?: string, finishingLabel?: string) => void;
  setError: (message: string | null) => void;
  remove: () => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function guardOn(): void {
  chrome.runtime.sendMessage({ type: MSG_ARO_GUARD_ON }).catch(() => {});
}

function guardOff(): void {
  chrome.runtime.sendMessage({ type: MSG_ARO_GUARD_OFF }).catch(() => {});
}

function chainPayload(
  alias: string,
  chain: ArolinksChain | null,
  fields: Pick<ArolinksChain, 'phase' | 'hops' | 'lastArticleUrl'>,
): ArolinksChain {
  return {
    alias,
    phase: fields.phase,
    hops: fields.hops,
    lastArticleUrl: fields.lastArticleUrl,
    unlockRestarts: chain?.unlockRestarts ?? 0,
    startedAt: chain?.startedAt || Date.now(),
  };
}

function hasMediatorVerifyUi(): boolean {
  return Boolean(document.getElementById('btn6') || document.getElementById('btn7') || document.getElementById('ce-time'));
}

function isArolinksRootHost(): boolean {
  const host = location.hostname.toLowerCase();
  const roots = [...new Set([...LOCAL_HOSTS, ...getHostsByKey(KEY)])];
  return roots.some((r) => host === r || host.endsWith(`.${r}`));
}

export function isArolinksBypassHost(): boolean {
  if (window !== window.top) return false;
  try {
    if (isArolinksRootHost()) return true;
    return isMediatorShell();
  } catch {
    return false;
  }
}

function isMediatorShell(): boolean {
  if (hasMediatorVerifyUi()) return true;
  const html = pageHtml();
  if (html.includes('/readmore') && /step\s*\d+\s*\/\s*\d+/i.test(html)) return true;
  return (
    html.length >= ARTICLE_MIN &&
    /step\s*\d+\s*\/\s*\d+/i.test(html) &&
    /GET\s*LINK|btn6|btn7|ce-time|\/readmore/i.test(html)
  );
}

function isMediatorLanding(): boolean {
  const html = pageHtml();
  if (html.length > LANDING_MAX) return false;
  if (hasMediatorVerifyUi()) return false;
  if (jsRedirectTarget(html, location.href)) return true;
  return /step\s*1\s*\/\s*3/i.test(html) && html.includes('/readmore');
}

function isMediatorArticle(): boolean {
  if (hasMediatorVerifyUi()) return true;
  const html = pageHtml();
  return (
    html.length >= ARTICLE_MIN &&
    /step\s*\d+\s*\/\s*\d+/i.test(html) &&
    /GET\s*LINK|btn6|btn7|ce-time|\/readmore/i.test(html)
  );
}

function resolveAlias(): string | null {
  const fromUrl = (): string | null => {
    try {
      const q = new URL(location.href).search;
      const m =
        q.match(/[?&](?:studiessuniversiitess|insurancessstudiess|insurancesseducatiionss)=([A-Za-z0-9]+)/i) ??
        q.match(/[?&]alias=([A-Za-z0-9]+)/i);
      const seg = m?.[1];
      return seg && seg.length >= 4 ? seg : null;
    } catch {
      return null;
    }
  };
  const fromHtml = (): string | null => {
    const m = pageHtml().match(/arolinks\.com\/([A-Za-z0-9]{4,})/i);
    const seg = m?.[1];
    if (!seg || ['links', 'auth', 'pages', 'api'].includes(seg)) return null;
    return seg;
  };
  return arolinksAliasFromLocation(location.href) ?? fromUrl() ?? fromHtml();
}

function lockPage(): void {
  if (!document.getElementById(PAGE_LOCK_ID)) {
    const lock = document.createElement('style');
    lock.id = PAGE_LOCK_ID;
    lock.textContent =
      'html,body{overflow:hidden!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}';
    document.documentElement.appendChild(lock);
  }
}

function unlockPage(): void {
  document.getElementById(PAGE_LOCK_ID)?.remove();
}

function mountOverlay(): Overlay {
  lockPage();
  let root = document.getElementById(OVERLAY_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.innerHTML =
      '<div style="position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.9);font-family:system-ui,sans-serif;color:#f8fafc;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:none;overscroll-behavior:contain;cursor:default;-webkit-tap-highlight-color:transparent">' +
      '<div style="min-width:280px;max-width:400px;padding:28px 32px;border-radius:16px;background:#1e293b;border:1px solid rgba(148,163,184,.25);text-align:center;pointer-events:none">' +
      '<div style="font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Skip Wait</div>' +
      '<div class="sw-phase" style="font-size:1.15rem;font-weight:600;color:#f1f5f9;margin-bottom:4px"></div>' +
      '<div class="sw-detail" style="font-size:.875rem;color:#94a3b8;margin-bottom:16px;min-height:1.25rem"></div>' +
      '<div class="sw-countdown" style="font-size:3rem;font-weight:700;line-height:1;color:#38bdf8;font-variant-numeric:tabular-nums;margin-bottom:4px;display:none"></div>' +
      '<div class="sw-countdown-label" style="font-size:.8rem;color:#64748b;margin-bottom:12px;display:none">seconds remaining</div>' +
      '<div class="sw-err" style="display:none;font-size:.85rem;color:#fca5a5;line-height:1.4"></div>' +
      '</div></div>';
    for (const type of PAGE_BLOCK_EVENTS) {
      root.addEventListener(
        type,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );
    }
    document.documentElement.appendChild(root);
  }
  const phase = root.querySelector<HTMLElement>('.sw-phase')!;
  const detail = root.querySelector<HTMLElement>('.sw-detail')!;
  const countdown = root.querySelector<HTMLElement>('.sw-countdown')!;
  const countdownLabel = root.querySelector<HTMLElement>('.sw-countdown-label')!;
  const err = root.querySelector<HTMLElement>('.sw-err')!;
  let tickId = 0;

  const stopCountdown = (): void => {
    if (tickId) {
      clearInterval(tickId);
      tickId = 0;
    }
    countdown.style.display = 'none';
    countdownLabel.style.display = 'none';
  };

  return {
    setPhase(title: string, detailText: string) {
      stopCountdown();
      phase.textContent = title;
      detail.textContent = detailText;
      err.style.display = 'none';
    },
    setDetail(detailText: string) {
      detail.textContent = detailText;
    },
    startCountdown(seconds: number, detailText?: string, finishingLabel = 'Finishing…') {
      stopCountdown();
      if (detailText) detail.textContent = detailText;
      let left = Math.max(0, Math.ceil(seconds));
      countdown.style.display = 'block';
      countdownLabel.style.display = 'block';
      countdownLabel.textContent = 'seconds remaining';
      const paint = (): void => {
        countdown.textContent = String(left);
      };
      paint();
      tickId = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(tickId);
          tickId = 0;
          countdown.textContent = '0';
          countdownLabel.textContent = finishingLabel;
          return;
        }
        paint();
      }, 1000);
    },
    setError(message: string | null) {
      stopCountdown();
      err.textContent = message ?? '';
      err.style.display = message ? 'block' : 'none';
    },
    remove() {
      stopCountdown();
      root.remove();
    },
  };
}

async function unlockPhase(alias: string, chain: ArolinksChain): Promise<boolean> {
  return (
    chain.phase === 'unlock' &&
    chain.alias === alias &&
    chain.hops >= MIN_MEDIATOR_HOPS &&
    Boolean(chain.lastArticleUrl || (await readPendingUnlock())?.referer)
  );
}

async function refererForUnlock(chain: ArolinksChain): Promise<string | null> {
  if (chain.lastArticleUrl) return chain.lastArticleUrl;
  return (await readPendingUnlock())?.referer ?? null;
}

async function markPendingUnlock(alias: string, articleUrl: string): Promise<void> {
  await writePendingUnlock({ alias, referer: articleUrl, at: Date.now() });
  try {
    sessionStorage.setItem(ARO_ALIAS_KEY, alias);
  } catch {}
}

async function clearPendingUnlock(): Promise<void> {
  await writePendingUnlock(null);
  try {
    sessionStorage.removeItem(ARO_FIRST_REDIRECT_KEY);
  } catch {}
}

function seedMediatorCookies(): void {
  for (const { name, value } of BYPASS_COOKIES) {
    document.cookie = `${name}=${value}; path=/; max-age=7200; SameSite=Lax`;
  }
}

function articleHopKey(hop: number): string {
  return `sw-aro-hop:${hop}:${location.hostname}:${location.pathname}`;
}

function markArticleHop(hop: number): void {
  try {
    sessionStorage.setItem(articleHopKey(hop), '1');
  } catch {}
}

function articleHopDone(hop: number): boolean {
  try {
    return sessionStorage.getItem(articleHopKey(hop)) === '1';
  } catch {
    return false;
  }
}

function triggerVerify(): void {
  const w = window as Window & { nextbtn?: () => void; continueBtn?: () => void };
  if (typeof w.nextbtn === 'function') {
    w.nextbtn();
    return;
  }
  if (typeof w.continueBtn === 'function') {
    w.continueBtn();
    return;
  }
  const btn = document.getElementById('btn6') ?? document.getElementById('btn7');
  if (btn instanceof HTMLElement) btn.click();
}

async function completeMediatorArticle(ui: Overlay): Promise<void> {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
  seedMediatorCookies();
  ui.startCountdown(VERIFY_WAIT_SEC, undefined, 'Finishing verification…');
  const end = Date.now() + VERIFY_WAIT_MS;
  while (Date.now() < end) {
    const cd = document.getElementById('countdown');
    if (cd) cd.textContent = '';
    const ce = document.getElementById('ce-time');
    if (ce) ce.textContent = '0';
    const btn6 = document.getElementById('btn6');
    if (btn6 instanceof HTMLElement && btn6.style.display !== 'none') triggerVerify();
    const btn7 = document.getElementById('btn7');
    if (btn7 instanceof HTMLElement && btn7.style.display !== 'none') btn7.click();
    await sleep(250);
  }
}

function openDestination(url: string): void {
  if (navigating) return;
  navigating = true;
  unlockPage();
  void clearPendingUnlock();
  guardOff();
  void clearArolinksChain();
  window.location.replace(url);
}

async function unlockDestination(html: string, pageReferer: string): Promise<string | null> {
  revealTimerLinks();
  const direct = deltaUrlFromHtml(html);
  if (direct) return direct;
  const form = linksGoFormFromHtml(html, pageReferer);
  if (form && !linksGoPosted) {
    linksGoPosted = true;
    return postLinksGo(form, pageReferer);
  }
  return null;
}

async function loadTimerShellOnPage(
  alias: string,
  referer: string,
  aroUrl: string,
): Promise<boolean> {
  try {
    const html = await fetchArolinksAliasPage(alias, referer);
    if (!isArolinksTimerShell(html)) return false;
    mountOverlay().remove();
    renderArolinksTimerPage(html);
    await sleep(200);
    const dest = await unlockDestination(html, aroUrl);
    if (dest) {
      await clearPendingUnlock();
      openDestination(dest);
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

async function runUnlockVisit(alias: string, chain: ArolinksChain): Promise<void> {
  if (unlockVisitActive) return;
  unlockVisitActive = true;
  const ui = mountOverlay();
  try {
    linksGoPosted = false;
    const referer = await refererForUnlock(chain);
    if (!referer) {
      ui.setPhase('Almost there', 'Complete the verification steps on the previous page.');
      ui.setError('Return to the article page and wait for verification to finish.');
      unlockPage();
      return;
    }
    const aroUrl = `https://arolinks.com/${alias}`;
    ui.setPhase('Opening your link', 'Loading the download page…');

    const end = Date.now() + UNLOCK_BURST_MS;
    if (await loadTimerShellOnPage(alias, referer, aroUrl)) return;

    while (Date.now() < end && !navigating) {
      if (isArolinksTimerShell()) {
        ui.remove();
        revealTimerLinks();
        const direct = deltaUrlFromDom();
        if (direct) {
          openDestination(direct);
          return;
        }
        const dest = await unlockDestination(pageHtml(), location.href);
        if (dest) openDestination(dest);
        return;
      }
      if (await loadTimerShellOnPage(alias, referer, aroUrl)) return;
      await sleep(UNLOCK_TICK_MS);
    }

    ui.setPhase('Could not open link', 'The download page did not load in time.');
    ui.setError('Reload the same arolinks URL in this tab after finishing all verification steps.');
    unlockPage();
  } finally {
    unlockVisitActive = false;
  }
}

async function runFirstArolinksVisit(alias: string, chain: ArolinksChain): Promise<void> {
  if (navigating || (await unlockPhase(alias, chain))) return;
  try {
    if (sessionStorage.getItem(ARO_FIRST_REDIRECT_KEY) === alias) return;
    sessionStorage.setItem(ARO_FIRST_REDIRECT_KEY, alias);
  } catch {}
  guardOff();
  await clearPendingUnlock();
  linksGoPosted = false;
  try {
    sessionStorage.setItem(ARO_ALIAS_KEY, alias);
  } catch {}
  await writeArolinksChain(
    chainPayload(alias, null, { phase: 'mediators', hops: 0, lastArticleUrl: null }),
  );
}

async function readmoreTargets(articleUrl: string): Promise<string[]> {
  const rm = new URL('/readmore/', location.origin).href;
  try {
    const r = await fetch(rm, {
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { Referer: articleUrl },
    });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get('location');
      if (loc) return [new URL(loc, rm).href];
    }
    const html = await r.text();
    const js = jsRedirectTarget(html, rm);
    if (js) return [js];
    return [
      ...new Set(
        [...html.matchAll(/https?:\/\/[^"'\s<>]+/g)]
          .map((m) => m[0])
          .filter(
            (u) =>
              !u.includes('wp-content') &&
              !u.includes('wp-includes') &&
              (u.includes('arolinks.com') ||
                /study|insurance|finance|univer|guruji|mahnokari|naukri|freehelpdesk|helpdesk|sarkari/i.test(
                  u,
                )),
          ),
      ),
    ];
  } catch {
    return [];
  }
}

async function followLanding(ui: Overlay): Promise<void> {
  ui.setPhase('Loading article', 'Opening the verification page…');
  const end = Date.now() + LANDING_POLL_MS;
  while (Date.now() < end) {
    const target = jsRedirectTarget(pageHtml(), location.href);
    if (target && target !== location.href) {
      navigating = true;
      window.location.replace(target);
      return;
    }
    if (isMediatorArticle()) return;
    await sleep(100);
  }
}

async function goToArolinksUnlock(
  alias: string,
  chain: ArolinksChain,
  articleUrl: string,
  nextHop: number,
  ui: Overlay,
  verified: boolean,
): Promise<void> {
  ui.setPhase('Almost done', 'Returning to your download link…');
  if (!verified) await completeMediatorArticle(ui);
  await markPendingUnlock(alias, articleUrl);
  await writeArolinksChain(
    chainPayload(alias, chain, { phase: 'unlock', hops: nextHop, lastArticleUrl: articleUrl }),
  );
  markArticleHop(nextHop);
  guardOn();
  navigating = true;
  window.location.replace(`https://arolinks.com/${alias}`);
}

async function runReadmoreHop(
  chain: ArolinksChain,
  alias: string,
  ui: Overlay,
): Promise<void> {
  const articleUrl = location.href;
  const nextHop = chain.hops + 1;
  const stepTotal = MIN_MEDIATOR_HOPS;

  if (articleHopDone(nextHop)) return;

  ui.setPhase(`Verification ${nextHop} of ${stepTotal}`, location.hostname.replace(/^www\./, ''));
  await completeMediatorArticle(ui);
  ui.setDetail('Loading next step…');
  const targets = await readmoreTargets(articleUrl);

  if (!targets.length) {
    markArticleHop(nextHop);
    navigating = true;
    window.location.replace(new URL('/readmore/', location.origin).href);
    return;
  }

  const mediators = targets.filter((u) => !u.includes('arolinks.com'));
  const next = mediators[0];

  if (nextHop >= MIN_MEDIATOR_HOPS) {
    await goToArolinksUnlock(alias, chain, articleUrl, nextHop, ui, true);
    return;
  }

  if (!next) {
    markArticleHop(nextHop);
    navigating = true;
    window.location.replace(new URL('/readmore/', location.origin).href);
    return;
  }

  await writeArolinksChain(
    chainPayload(alias, chain, { phase: 'mediators', hops: nextHop, lastArticleUrl: articleUrl }),
  );
  markArticleHop(nextHop);
  navigating = true;
  window.location.replace(next);
}

async function runMediatorFlow(chain: ArolinksChain, alias: string): Promise<void> {
  const ui = mountOverlay();
  seedMediatorCookies();

  if (chain.phase === 'unlock' && isMediatorArticle()) {
    const referer = chain.lastArticleUrl ?? (await readPendingUnlock())?.referer;
    await goToArolinksUnlock(alias, chain, referer ?? location.href, chain.hops, ui, false);
    return;
  }

  if (isMediatorLanding()) {
    await followLanding(ui);
    return;
  }

  if (isMediatorArticle()) {
    await runReadmoreHop(chain, alias, ui);
  }
}

async function runArolinksFlow(): Promise<void> {
  const alias = arolinksAliasFromLocation(location.href);
  if (!alias) return;

  let chain = await readArolinksChain();

  if (chainNeedsReset(chain, alias)) {
    await clearPendingUnlock();
    await clearArolinksChain();
    chain = { ...EMPTY_AROLINKS_CHAIN };
  }

  if (isArolinksPleaseWait()) {
    if (await unlockPhase(alias, chain)) {
      guardOn();
      await runUnlockVisit(alias, chain);
      return;
    }
    mountOverlay().setPhase(
      'Starting verification',
      'You will be redirected to complete a few quick steps.',
    );
    guardOff();
    await runFirstArolinksVisit(alias, chain);
    return;
  }

  if (await unlockPhase(alias, chain)) {
    guardOn();
    await runUnlockVisit(alias, chain);
    return;
  }

  if (isArolinksTimerShell()) {
    mountOverlay().remove();
    guardOff();
    revealTimerLinks();
    const direct = deltaUrlFromDom();
    if (direct) {
      openDestination(direct);
      return;
    }
    const dest = await unlockDestination(pageHtml(), location.href);
    if (dest) openDestination(dest);
  }
}

async function runFlow(): Promise<void> {
  if (flowRunning || navigating) return;
  if (!isArolinksBypassHost()) return;
  flowRunning = true;
  try {
    const aroAlias = arolinksAliasFromLocation(location.href);
    if (aroAlias) {
      await runArolinksFlow();
      return;
    }

    if (!isMediatorShell()) return;

    const chain = await readArolinksChain();
    let alias = resolveAlias() ?? chain.alias;
    if (!alias) {
      try {
        alias = sessionStorage.getItem(ARO_ALIAS_KEY);
      } catch {}
    }
    if (!alias) return;

    let activeChain = chain;
    if (!chain.alias || chain.alias !== alias) {
      await writeArolinksChain(
        chainPayload(alias, null, { phase: 'mediators', hops: 0, lastArticleUrl: null }),
      );
      activeChain = await readArolinksChain();
    }
    await runMediatorFlow(activeChain, alias);
  } finally {
    flowRunning = false;
  }
}

export function initArolinksBypass(): void {
  const alias = arolinksAliasFromLocation(location.href);
  if (alias) {
    void readArolinksChain().then((chain) => {
      if (chain.phase !== 'unlock' || chain.alias !== alias || chain.hops < MIN_MEDIATOR_HOPS) {
        return;
      }
      guardOn();
    });
  }

  const start = async (): Promise<void> => {
    if (!isArolinksBypassHost()) return;
    if (navigating) return;
    const flowKey = `${location.href}|${(await readPendingUnlock())?.alias ?? ''}`;
    if (flowKey === lastFlowKey && flowRunning) return;
    lastFlowKey = flowKey;
    await runFlow();
  };

  whenDomParsed(() => {
    void start();
  });
  if (document.readyState !== 'loading') void start();
}
