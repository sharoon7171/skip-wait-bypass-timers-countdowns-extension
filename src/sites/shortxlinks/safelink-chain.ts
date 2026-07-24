import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { whenDomParsed } from '../../utils/domain-check';
import {
  SHORTX_CHECK_UNLOCK,
  SHORTX_FETCH_CHAIN,
  shortxResultKey,
  type ShortxFetchResult,
} from './chain';
import {
  isShortxHost,
  isShortxMediatorHost,
  isShortxMediatorPage,
  isShortxPipelinePage,
  isShortxTimerPage,
  isShortxTokenUrl,
  SHORTX_AD_WAIT_MS,
  shortxAliasFromAdlinkfly,
  shortxAliasFromPath,
  shortxStartUrl,
  shortxStartUrlFromText,
} from './hosts';

const OVERLAY_ID = 'skip-wait-shortxlinks-overlay';
const BOOT_STYLE_ID = 'skip-wait-shortxlinks-boot';
const UNLOCK_POLL_MS = 250;
const SESSION_START = 'sw-shortx-start-url';
const SESSION_TOKEN = 'sw-shortx-token-url';
const SESSION_AD_TIME = 'sw-shortx-ad-time';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

type StoredResult = { tokenUrl: string; adTime: number };

let flowRunning = false;
let flowStarted = false;
let ui: FullPageOverlay | null = null;

function requestVisibilitySpoof(): void {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
}

function bootOverlayLock(): void {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
}

function mountUi(status = 'Getting things ready…'): FullPageOverlay {
  bootOverlayLock();
  if (ui) {
    ui.setNote(NOTE);
    ui.setStatus(status);
    ui.setError(null);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
    countdownLabel: 'Your link opens in',
  });
  return ui;
}

function hasSession(): boolean {
  try {
    return !!(sessionStorage.getItem(SESSION_START) || sessionStorage.getItem(SESSION_TOKEN));
  } catch {
    return false;
  }
}

function resolveStartUrl(): string | null {
  try {
    const stored = sessionStorage.getItem(SESSION_START);
    if (stored) return stored;
  } catch {}

  const adAlias = shortxAliasFromAdlinkfly(location.search);
  if (adAlias) return shortxStartUrl(adAlias);

  const go = document.querySelector<HTMLInputElement>('input[name="go"]')?.value?.trim();
  if (go) {
    try {
      const fromGo = shortxStartUrlFromText(atob(go));
      if (fromGo) return fromGo;
    } catch {}
  }

  if (isShortxTimerPage()) {
    const alias = shortxAliasFromPath(location.pathname);
    if (alias) return shortxStartUrl(alias);
  }

  return null;
}

function persistStartFromLocation(): void {
  if (!isShortxPipelinePage() && !hasSession()) return;
  const start = resolveStartUrl();
  if (!start) return;
  try {
    sessionStorage.setItem(SESSION_START, start);
  } catch {}
}

function readStoredResult(): StoredResult | null {
  try {
    const tokenUrl = sessionStorage.getItem(SESSION_TOKEN);
    const adTime = Number(sessionStorage.getItem(SESSION_AD_TIME));
    if (tokenUrl && isShortxTokenUrl(tokenUrl) && adTime > 0) {
      if (Date.now() <= adTime + SHORTX_AD_WAIT_MS + 60_000) return { tokenUrl, adTime };
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
  return isShortxTimerPage() && !document.title.includes('Too Early');
}

function isTooEarlyShortx(): boolean {
  return isShortxHost() && document.title.includes('Too Early');
}

function shouldRunEager(): boolean {
  if (hasSession()) return true;
  if (shortxAliasFromAdlinkfly(location.search)) return true;
  if (!isShortxHost() || !shortxAliasFromPath(location.pathname)) return false;
  return location.search.length > 1 || document.title.includes('Too Early');
}

function shouldRun(): boolean {
  if (window !== window.top) return false;
  if (isShortxFinalTimerPage()) return true;
  if (isTooEarlyShortx() && readStoredResult()) return true;
  if (isShortxMediatorPage()) return true;
  if (hasSession() && isShortxPipelinePage()) return true;
  return false;
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

async function fetchVerification(startUrl: string): Promise<StoredResult | { ok: false; error: string }> {
  const stored = readStoredResult();
  if (stored) return stored;
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

async function finishOnTimerPage(overlay: FullPageOverlay): Promise<boolean> {
  overlay.hideCountdown();
  overlay.setStatus('Unlocking your link…');
  for (let i = 0; i < 120; i++) {
    const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
    if (form) {
      const dest = await postLinksGo();
      if (dest) {
        clearChainSession();
        overlay.setStatus('Opening your link…');
        window.location.replace(dest);
        return true;
      }
    }
    await sleep(250);
  }
  overlay.setError('Couldn’t unlock this link. Reload and try again.');
  flowStarted = false;
  return false;
}

async function waitForUnlock(overlay: FullPageOverlay, tokenUrl: string, adTime: number): Promise<void> {
  const unlockAt = adTime + SHORTX_AD_WAIT_MS;
  const deadline = unlockAt + 8_000;
  overlay.setStatus('Waiting for timer…');
  if (Date.now() < unlockAt) overlay.startCountdown(unlockAt);
  while (Date.now() < deadline) {
    if (await isTokenUnlocked(tokenUrl)) {
      overlay.hideCountdown();
      if (normalizePageUrl(location.href) === normalizePageUrl(tokenUrl)) {
        await finishOnTimerPage(overlay);
        return;
      }
      overlay.setStatus('Opening your link…');
      window.location.replace(tokenUrl);
      return;
    }
    await sleep(UNLOCK_POLL_MS);
  }
  overlay.hideCountdown();
  overlay.setError('Timer wait timed out. Reload and try again.');
  flowStarted = false;
}

async function runFlow(): Promise<void> {
  if (flowRunning || flowStarted || !shouldRun()) return;
  flowRunning = true;
  flowStarted = true;
  requestVisibilitySpoof();
  const overlay = mountUi();
  try {
    persistStartFromLocation();
    const stored = readStoredResult();
    if (
      isShortxFinalTimerPage() ||
      (stored && normalizePageUrl(location.href) === normalizePageUrl(stored.tokenUrl))
    ) {
      await finishOnTimerPage(overlay);
      return;
    }
    if (isTooEarlyShortx() && stored) {
      await waitForUnlock(overlay, stored.tokenUrl, stored.adTime);
      return;
    }
    const startUrl = resolveStartUrl();
    if (!startUrl) {
      overlay.setError('Short link missing — open the original link again.');
      flowStarted = false;
      return;
    }
    overlay.setStatus('Verifying your link…');
    const result = await fetchVerification(startUrl);
    if ('ok' in result && result.ok === false) {
      overlay.setError(result.error || 'Verification failed. Reload and try again.');
      flowStarted = false;
      return;
    }
    await waitForUnlock(overlay, (result as StoredResult).tokenUrl, (result as StoredResult).adTime);
  } catch {
    overlay.setError('Something went wrong — reload and try again.');
    flowStarted = false;
  } finally {
    flowRunning = false;
  }
}

export function initShortxlinksSafelinkChain(): void {
  if (window !== window.top) return;
  if (
    !isShortxHost() &&
    !isShortxMediatorHost() &&
    !shortxAliasFromAdlinkfly(location.search) &&
    !hasSession()
  )
    return;

  persistStartFromLocation();
  if (shouldRunEager()) {
    bootOverlayLock();
    requestVisibilitySpoof();
  }
  const start = (): void => {
    if (!shouldRun()) return;
    requestVisibilitySpoof();
    void runFlow();
  };
  if (shouldRunEager()) start();
  whenDomParsed(start);
}
