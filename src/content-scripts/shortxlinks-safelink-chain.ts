import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import {
  SHORTX_CHECK_UNLOCK,
  SHORTX_FETCH_CHAIN,
  shortxResultKey,
  type ShortxFetchResult,
} from '../shared/shortx-fetch-chain';

const KEY = 'shortxlinks-safelink-chain';
const LOCAL_HOSTS = ['shortxlinks.com', 'flexthecar.com', 'nkrmusic.in.net'] as const;
const OVERLAY_ID = 'skip-wait-shortx-overlay';
const PAGE_LOCK_ID = 'skip-wait-shortx-page-lock';
const AD_WAIT_MS = 22_000;
const UNLOCK_POLL_MS = 250;
const SESSION_START = 'sw-shortx-start-url';
const SESSION_TOKEN = 'sw-shortx-token-url';
const SESSION_AD_TIME = 'sw-shortx-ad-time';

type StoredResult = { tokenUrl: string; adTime: number };
type OverlayUi = {
  setStatus: (t: string) => void;
  setError: (t: string | null) => void;
  startCountdown: (endTs: number) => void;
  stopCountdown: () => void;
};

let overlay: OverlayUi | null = null;
let flowRunning = false;
let flowStarted = false;

function allowedHosts(): readonly string[] {
  return [...new Set([...LOCAL_HOSTS, ...getHostsByKey(KEY)])];
}

function persistStartFromLocation(): void {
  try {
    if (location.hostname.includes('shortxlinks.com')) {
      const m = location.pathname.match(/\/(rcz_[^/?#]+)/i);
      if (m) sessionStorage.setItem(SESSION_START, `https://shortxlinks.com/${m[1]}`);
    }
    const adlink = location.search.match(/[?&]adlinkfly=(rcz_[^&?#]+)/i);
    if (adlink) sessionStorage.setItem(SESSION_START, `https://shortxlinks.com/${adlink[1]}`);
  } catch {}
}

function startUrlFromPage(): string | null {
  try {
    const stored = sessionStorage.getItem(SESSION_START);
    if (stored) return stored;
  } catch {}
  if (location.hostname.includes('shortxlinks.com')) {
    const m = location.pathname.match(/\/(rcz_[^/?#]+)/i);
    if (m) return `https://shortxlinks.com/${m[1]}`;
  }
  const adlink = location.search.match(/[?&]adlinkfly=(rcz_[^&?#]+)/i);
  if (adlink) return `https://shortxlinks.com/${adlink[1]}`;
  const go = document.querySelector<HTMLInputElement>('input[name="go"]')?.value?.trim();
  if (go) {
    try {
      const match = atob(go).match(/https:\/\/shortxlinks\.com\/rcz_[^?\s"']+/i);
      if (match) return match[0].split('?')[0] ?? match[0];
    } catch {}
  }
  const html = document.documentElement?.innerHTML ?? '';
  const match = html.match(/https:\/\/shortxlinks\.com\/rcz_[^?"'\s&]+/i);
  return match?.[0].split('?')[0] ?? null;
}

function readStoredResult(): StoredResult | null {
  try {
    const tokenUrl = sessionStorage.getItem(SESSION_TOKEN);
    const adTime = Number(sessionStorage.getItem(SESSION_AD_TIME));
    if (tokenUrl && adTime > 0) {
      if (Date.now() <= adTime + AD_WAIT_MS + 60_000) return { tokenUrl, adTime };
      sessionStorage.removeItem(SESSION_TOKEN);
      sessionStorage.removeItem(SESSION_AD_TIME);
    }
  } catch {}
  return null;
}

function storeResult(tokenUrl: string, adTime: number): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN, tokenUrl);
    sessionStorage.setItem(SESSION_AD_TIME, String(adTime));
  } catch {}
}

function clearChainSession(): void {
  try {
    sessionStorage.removeItem(SESSION_START);
    sessionStorage.removeItem(SESSION_TOKEN);
    sessionStorage.removeItem(SESSION_AD_TIME);
  } catch {}
}

function normalizePageUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname + u.search;
  } catch {
    return url.split('#')[0] ?? url;
  }
}

function isShortxFinalTimerPage(): boolean {
  if (!location.hostname.includes('shortxlinks.com')) return false;
  if (!/\/rcz_/i.test(location.pathname)) return false;
  if (document.title.includes('Too Early')) return false;
  if (location.search.length > 1) return true;
  return !!document.querySelector('#go-link, form[action*="/links/go"]');
}

function isTooEarlyShortx(): boolean {
  return location.hostname.includes('shortxlinks.com') && document.title.includes('Too Early');
}

function hasChainMarkers(): boolean {
  if (startUrlFromPage()) return true;
  if (/[?&]adlinkfly=rcz_/i.test(location.search)) return true;
  if (document.querySelector('input[name="newwpsafelink"], input[name="go"], #wpsafelinkhuman, #wpsafelink-landing'))
    return true;
  try {
    if (sessionStorage.getItem(SESSION_START) || sessionStorage.getItem(SESSION_TOKEN)) return true;
  } catch {}
  return false;
}

function shouldRunEager(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_START)) return true;
  } catch {}
  return (
    (location.hostname.includes('shortxlinks.com') && /\/rcz_/i.test(location.pathname)) ||
    /[?&]adlinkfly=rcz_/i.test(location.search)
  );
}

function shouldRun(): boolean {
  if (window !== window.top) return false;
  const inChain = hasChainMarkers();
  if (!isAllowedHost(allowedHosts()) && !inChain) return false;
  if (
    location.hostname.includes('shortxlinks.com') &&
    document.querySelector('#go-link, form[action*="/links/go"]') &&
    !document.title.includes('Too Early')
  )
    return true;
  if (isTooEarlyShortx() && readStoredResult()) return true;
  return inChain;
}

function overlayCss(): string {
  const o = OVERLAY_ID;
  return `#${o}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(15,23,42,.86);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc;pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:default;overscroll-behavior:contain;touch-action:none}#${o} *{user-select:none;-webkit-user-select:none;pointer-events:none}#${o} .sw-card{max-width:420px;width:100%;border-radius:16px;padding:22px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}#${o} .sw-brand{font-size:1.25rem;font-weight:700;color:#38bdf8;margin-bottom:6px}#${o} .sw-note{font-size:.875rem;line-height:1.55;color:#cbd5e1;margin-bottom:14px}#${o} .sw-note strong{color:#e2e8f0;font-weight:600}#${o} .sw-status{font-size:.9rem;color:#e2e8f0;min-height:1.4em;margin-bottom:10px}#${o} .sw-count{font-size:2.5rem;font-weight:700;font-variant-numeric:tabular-nums;color:#f1f5f9;text-align:center;margin:6px 0 4px}#${o} .sw-count-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;text-align:center;margin-top:4px}#${o} .sw-err{font-size:.85rem;color:#fca5a5;margin-top:10px;line-height:1.45}`;
}

function lockPage(): void {
  if (!document.getElementById(PAGE_LOCK_ID)) {
    const lock = document.createElement('style');
    lock.id = PAGE_LOCK_ID;
    lock.textContent =
      'html,body{overflow:hidden!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}';
    document.documentElement.appendChild(lock);
  }
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
}

function mountOverlay(): OverlayUi {
  if (overlay) return overlay;
  lockPage();
  document.querySelectorAll(`#${OVERLAY_ID}`).forEach((node, index) => {
    if (index > 0) node.remove();
  });
  let root = document.getElementById(OVERLAY_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = OVERLAY_ID;
    const style = document.createElement('style');
    style.textContent = overlayCss();
    root.appendChild(style);
    const card = document.createElement('div');
    card.className = 'sw-card';
    card.innerHTML =
      '<div class="sw-brand">Skip Wait</div>' +
      '<div class="sw-note"><strong>Hang tight — getting your link ready.</strong> You don\'t need to tap anything. We\'ll open your destination automatically.</div>' +
      '<div class="sw-status">Verifying in the background…</div>' +
      '<div class="sw-count" style="display:none"></div>' +
      '<div class="sw-count-label" style="display:none">Your link opens in</div>' +
      '<div class="sw-err" style="display:none"></div>';
    root.appendChild(card);
    document.documentElement.appendChild(root);
    for (const type of ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel', 'keydown'] as const) {
      root.addEventListener(
        type,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );
    }
  }
  const status = root.querySelector<HTMLElement>('.sw-status')!;
  const count = root.querySelector<HTMLElement>('.sw-count')!;
  const countLabel = root.querySelector<HTMLElement>('.sw-count-label')!;
  const err = root.querySelector<HTMLElement>('.sw-err')!;
  let rafId = 0;
  overlay = {
    setStatus: (t: string) => {
      status.textContent = t;
    },
    setError: (t: string | null) => {
      err.textContent = t ?? '';
      err.style.display = t ? 'block' : 'none';
    },
    startCountdown: (endTs: number) => {
      countLabel.style.display = 'block';
      count.style.display = 'block';
      const tick = (): void => {
        const left = endTs - Date.now();
        count.textContent = `${(Math.max(0, left) / 1000).toFixed(2)} s`;
        if (left <= 0) {
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    },
    stopCountdown: () => {
      cancelAnimationFrame(rafId);
      count.style.display = countLabel.style.display = 'none';
    },
  };
  return overlay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function readBackgroundResult(startUrl: string): Promise<ShortxFetchResult | null> {
  const key = shortxResultKey(startUrl);
  const data = await chrome.storage.local.get(key);
  const result = data[key] as ShortxFetchResult | undefined;
  if (!result) return null;
  await chrome.storage.local.remove(key);
  return result;
}

async function requestFetchChain(startUrl: string): Promise<ShortxFetchResult> {
  const cached = await readBackgroundResult(startUrl);
  if (cached) return cached;
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage({ type: SHORTX_FETCH_CHAIN, startUrl }, () => resolve());
  });
  for (let i = 0; i < 120; i++) {
    const result = await readBackgroundResult(startUrl);
    if (result) return result;
    await sleep(500);
  }
  return { ok: false, error: 'verification timed out' };
}

async function fetchVerification(startUrl: string, ui: OverlayUi): Promise<StoredResult | { ok: false; error: string }> {
  const stored = readStoredResult();
  if (stored) return stored;
  ui.setStatus('Running verification in the background…');
  const result = await requestFetchChain(startUrl);
  if (!result.ok) return result;
  storeResult(result.tokenUrl, result.adTime);
  return { tokenUrl: result.tokenUrl, adTime: result.adTime };
}

async function isTokenUnlocked(tokenUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: SHORTX_CHECK_UNLOCK, tokenUrl }, (resp) => {
      resolve(!chrome.runtime.lastError && !!resp?.unlocked);
    });
  });
}

async function postLinksGo(): Promise<string | null> {
  const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
  if (!form) return null;
  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, typeof v === 'string' ? v : ''));
  const action =
    form.action && /^https?:\/\//.test(form.action)
      ? form.action
      : new URL(form.getAttribute('action') || '/links/go', location.origin).href;
  const r = await fetch(action, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  const text = await r.text();
  try {
    const data = JSON.parse(text) as { url?: string };
    return typeof data.url === 'string' && /^https?:\/\//.test(data.url.trim()) ? data.url.trim() : null;
  } catch {
    return null;
  }
}

async function finishOnTimerPage(ui: OverlayUi): Promise<boolean> {
  ui.setStatus('Opening your destination…');
  let posted = false;
  for (let i = 0; i < 120; i++) {
    const link = document.querySelector<HTMLAnchorElement>('a.get-link');
    if (link?.href && /^https?:\/\//.test(link.href) && !link.classList.contains('disabled')) {
      clearChainSession();
      window.location.replace(link.href);
      return true;
    }
    const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
    if (form && !posted) {
      posted = true;
      const dest = await postLinksGo();
      if (dest) {
        clearChainSession();
        window.location.replace(dest);
        return true;
      }
    }
    await sleep(250);
  }
  ui.setError('Could not generate link. Try refreshing.');
  flowStarted = false;
  return false;
}

async function waitForUnlock(tokenUrl: string, adTime: number, ui: OverlayUi): Promise<void> {
  const endTs = adTime + AD_WAIT_MS;
  ui.setStatus('Waiting for your link to unlock…');
  ui.startCountdown(endTs);
  while (Date.now() < endTs + 8_000) {
    if (await isTokenUnlocked(tokenUrl)) {
      ui.stopCountdown();
      ui.setStatus('Opening your link…');
      if (normalizePageUrl(location.href) === normalizePageUrl(tokenUrl)) {
        await finishOnTimerPage(ui);
        return;
      }
      window.location.replace(tokenUrl);
      return;
    }
    await sleep(UNLOCK_POLL_MS);
  }
  ui.stopCountdown();
  ui.setStatus('Opening your link…');
  if (normalizePageUrl(location.href) === normalizePageUrl(tokenUrl)) {
    await finishOnTimerPage(ui);
    return;
  }
  window.location.replace(tokenUrl);
}

async function runFlow(): Promise<void> {
  if (flowRunning || flowStarted || !shouldRun()) return;
  flowRunning = true;
  flowStarted = true;
  const ui = mountOverlay();
  try {
    persistStartFromLocation();
    const stored = readStoredResult();
    if (
      isShortxFinalTimerPage() ||
      (stored && normalizePageUrl(location.href) === normalizePageUrl(stored.tokenUrl))
    ) {
      await finishOnTimerPage(ui);
      return;
    }
    if (isTooEarlyShortx() && stored) {
      await waitForUnlock(stored.tokenUrl, stored.adTime, ui);
      return;
    }
    const startUrl = startUrlFromPage();
    if (!startUrl) return;
    const result = await fetchVerification(startUrl, ui);
    if ('ok' in result && result.ok === false) {
      ui.setError(result.error);
      ui.setStatus('Verification failed.');
      flowStarted = false;
      return;
    }
    await waitForUnlock((result as StoredResult).tokenUrl, (result as StoredResult).adTime, ui);
  } finally {
    flowRunning = false;
  }
}

export function initShortxlinksSafelinkChain(): void {
  if (window !== window.top) return;
  persistStartFromLocation();
  if (shouldRunEager()) mountOverlay();
  const start = (): void => {
    if (!shouldRun()) return;
    mountOverlay();
    void runFlow();
  };
  if (shouldRunEager()) start();
  whenDomParsed(start);
}

if (typeof window !== 'undefined' && window === window.top) {
  persistStartFromLocation();
  if (shouldRunEager()) mountOverlay();
}
