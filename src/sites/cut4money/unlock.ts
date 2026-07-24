import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../adlinkfly/unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import {
  clearCut4moneyChain,
  cut4moneyAliasFromPath,
  ensureCut4moneyChain,
} from './chain';
import { CUT4MONEY_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-cut4money-unlock';
const BOOT_STYLE_ID = 'skip-wait-cut4money-unlock-boot';
const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: 'Skip Wait is working. You don’t need to tap anything.',
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

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

const isRealUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
  bootOverlayLock();
  if (ui) {
    ui.setStatus(status);
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

const isAliasPath = (): boolean => cut4moneyAliasFromPath(location.pathname) !== null;

const isUnlockShell = (): boolean => {
  if (!document.querySelector('#go-link, form[action*="/links/go"]')) return false;
  return Boolean(document.querySelector('input[name="ad_form_data"]'));
};

const counterSec = (): number => {
  const page = document.documentElement.innerHTML;
  const m = page.match(/["']counter_value["']\s*:\s*["']?(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer, #counter');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const counterReady = (): boolean =>
  /["']counter_value["']\s*:\s*["']?\d+/.test(document.documentElement.innerHTML) ||
  Boolean(document.querySelector('#timer, #countdown, .timer, #counter')?.textContent?.trim());

const recordChain = (): void => {
  const alias = cut4moneyAliasFromPath(location.pathname);
  if (!alias) return;
  void ensureCut4moneyChain(alias, location.origin);
};

const postFromPage = (): Promise<string | null> => {
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) return Promise.resolve(null);
  return postLinksGo(form, location.href);
};

const runUnlock = async (): Promise<void> => {
  if (started || !isUnlockShell()) return;
  started = true;
  requestVisibilitySpoof();
  recordChain();
  const overlay = mountUi('Getting things ready…');

  for (let i = 0; i < 50 && !counterReady(); i++) await sleep(100);

  const sec = counterSec();
  if (sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + sec * 1000);
    await sleep(sec * 1000);
    overlay.hideCountdown();
  }

  if (!isUnlockShell()) {
    started = false;
    return;
  }

  revealTimerLinks();
  const existing = document.querySelector<HTMLAnchorElement>('a.get-link, #gt-link');
  if (existing?.href && isRealUrl(existing.href)) {
    overlay.setStatus('Opening your link…');
    await clearCut4moneyChain();
    location.replace(existing.href);
    return;
  }

  overlay.setStatus('Unlocking your link…');
  let url = await postFromPage();
  if (!url && sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + (sec + 2) * 1000);
    const endAt = Date.now() + (sec + 2) * 1000;
    while (!url && Date.now() < endAt) {
      revealTimerLinks();
      url = await postFromPage();
      if (url) break;
      await sleep(200);
    }
    overlay.hideCountdown();
  }

  if (!url) {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    started = false;
    return;
  }

  overlay.setStatus('Opening your link…');
  await clearCut4moneyChain();
  location.replace(url);
};

export function initCut4moneyUnlock(): void {
  if (!isAllowedHost(CUT4MONEY_HOSTS)) return;
  if (!isAliasPath()) return;

  const tick = (): void => {
    if (started) return;
    if (!isUnlockShell()) return;
    if (!counterReady() && document.readyState === 'loading') {
      bootOverlayLock();
      mountUi('Getting things ready…');
      return;
    }
    mountUi('Getting things ready…');
    void runUnlock();
  };

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    tick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, {
    attributeFilter: ['href', 'value'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
