import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import {
  arolinksAliasFromPath,
  clearArolinksChain,
  ensureArolinksChain,
} from './chain';
import { AROLINKS_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-arolinks-unlock';
const BOOT_STYLE_ID = 'skip-wait-arolinks-unlock-boot';
const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: 'Skip Wait is working. You don’t need to tap anything.',
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

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

const isRealHttp = (href: string): boolean => /^https?:\/\//i.test(href);

const isUnlockShell = (): boolean => {
  if (!document.querySelector('#gt-link')) return false;
  if (!document.querySelector('#go-link')) return false;
  return document.documentElement.innerHTML.includes('ad_form_data');
};

const gtLinkDestination = (): string | null => {
  const a = document.querySelector<HTMLAnchorElement>('#gt-link');
  if (!a) return null;
  const raw = (a.getAttribute('href') || '').trim();
  if (isRealHttp(raw)) return raw;
  const abs = (a.href || '').trim();
  return isRealHttp(abs) ? abs : null;
};

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

const recordChain = (): void => {
  const alias = arolinksAliasFromPath(location.pathname);
  if (!alias) return;
  void ensureArolinksChain(alias, location.origin);
};

const runUnlock = (): void => {
  if (started || !isUnlockShell()) return;
  const url = gtLinkDestination();
  if (!url) return;
  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Opening your link…');
  void clearArolinksChain();
  overlay.setStatus('Opening your link…');
  location.replace(url);
};

export function initArolinksUnlock(): void {
  if (!isAllowedHost(AROLINKS_HOSTS)) return;

  const alias = arolinksAliasFromPath(location.pathname);
  if (alias) recordChain();

  const tick = (): void => {
    if (started) return;
    if (!isUnlockShell()) return;
    mountUi('Opening your link…');
    runUnlock();
  };

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    tick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, {
    attributeFilter: ['href'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
