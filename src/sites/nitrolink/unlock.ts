import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../adlinkfly/unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import {
  clearNitrolinkChain,
  ensureNitrolinkChain,
  nitrolinkAliasFromPath,
} from './chain';
import { NITROLINK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-nitrolink-unlock';
const BOOT_STYLE_ID = 'skip-wait-nitrolink-unlock-boot';
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

const isAliasPath = (): boolean => nitrolinkAliasFromPath(location.pathname) !== null;

const isGateHandshake = (): boolean => {
  try {
    return new URLSearchParams(location.search).has('gate');
  } catch {
    return false;
  }
};

const isUnlockShell = (): boolean => {
  if (isGateHandshake()) return false;
  if (!document.querySelector('#go-link, form[action*="/links/go"]')) return false;
  return Boolean(document.querySelector('input[name="ad_form_data"]'));
};

const counterSec = (): number => {
  const html = document.documentElement.innerHTML;
  const m = html.match(/["']counter_value["']\s*:\s*["']?(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  return 0;
};

const recordChain = (): void => {
  const alias = nitrolinkAliasFromPath(location.pathname);
  if (!alias) return;
  void ensureNitrolinkChain(alias, location.origin);
};

const runUnlock = async (): Promise<void> => {
  if (started || !isUnlockShell()) return;
  started = true;
  requestVisibilitySpoof();
  recordChain();
  const overlay = mountUi('Getting things ready…');

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
    await clearNitrolinkChain();
    location.replace(existing.href);
    return;
  }

  overlay.setStatus('Unlocking your link…');
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) {
    overlay.setStatus('This page isn’t ready yet. Reload and try again.');
    started = false;
    return;
  }

  const url = await postLinksGo(form, location.href);
  if (!url) {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    started = false;
    return;
  }

  overlay.setStatus('Opening your link…');
  await clearNitrolinkChain();
  location.replace(url);
};

export function initNitrolinkUnlock(): void {
  if (!isAllowedHost(NITROLINK_HOSTS)) return;
  if (!isAliasPath()) return;
  if (isGateHandshake()) return;

  const tick = (): void => {
    if (started) return;
    if (isGateHandshake()) return;
    if (!isUnlockShell()) return;
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
