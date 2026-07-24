import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../adlinkfly/unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { SHRINKME_UNLOCK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-shrinkme-unlock';
const BOOT_STYLE_ID = 'skip-wait-shrinkme-unlock-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let unlockStarted = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const bootOverlayLock = (): void => {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
};

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
  bootOverlayLock();
  if (ui) {
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
};

const isAliasPath = (): boolean => {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return parts.length === 1 && ALIAS_RE.test(parts[0]!);
};

const isRealUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const isUnlockShell = (): boolean =>
  Boolean(
    document.querySelector('#go-link, form[action*="/links/go"]') &&
      document.querySelector('input[name="ad_form_data"]'),
  );

const counterSec = (): number => {
  const page = document.documentElement.innerHTML;
  const m = page.match(/["']counter_value["']\s*:\s*["']?(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer, #counter');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const runUnlock = async (): Promise<void> => {
  if (unlockStarted || !isUnlockShell()) return;
  unlockStarted = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Getting things ready…');

  const sec = counterSec();
  if (sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + sec * 1000);
    await sleep(sec * 1000);
    overlay.hideCountdown();
  }

  if (!isUnlockShell()) {
    unlockStarted = false;
    return;
  }

  revealTimerLinks();
  const existing = document.querySelector<HTMLAnchorElement>('a.get-link, #gt-link');
  if (existing?.href && isRealUrl(existing.href)) {
    overlay.setStatus('Opening your link…');
    location.replace(existing.href);
    return;
  }

  overlay.setStatus('Unlocking your link…');
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) {
    overlay.setStatus('This page isn’t ready yet. Reload and try again.');
    unlockStarted = false;
    return;
  }

  let url = await postLinksGo(form, location.href);
  if (!url && sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + (sec + 2) * 1000);
    const endAt = Date.now() + (sec + 2) * 1000;
    while (!url && Date.now() < endAt) {
      revealTimerLinks();
      url = await postLinksGo(form, location.href);
      if (url) break;
      await sleep(200);
    }
    overlay.hideCountdown();
  }

  if (!url) {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    unlockStarted = false;
    return;
  }

  overlay.setStatus('Opening your link…');
  location.replace(url);
};

const tick = (): void => {
  if (isUnlockShell()) void runUnlock();
};

export function initShrinkmeUnlock(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(SHRINKME_UNLOCK_HOSTS)) return;
  if (!isAliasPath()) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, {
    attributeFilter: ['href', 'value', 'disabled'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
