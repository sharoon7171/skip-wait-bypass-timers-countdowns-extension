import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { SFL_BLOG_HOSTS, SFL_HOSTS } from './hosts';
import {
  destFromReadyPage,
  landingRedirectUrl,
  unlockFromBlog,
} from './unlock';

const OVERLAY_ID = 'skip-wait-sfl-overlay';
const BOOT_STYLE_ID = 'skip-wait-sfl-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
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

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
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
  });
  return ui;
};

const isAliasPath = (): boolean => {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return parts.length === 1 && ALIAS_RE.test(parts[0]!);
};

const isReadyPath = (): boolean => /^\/ready\/go\/?$/i.test(location.pathname);

const isExternalDest = (href: string): boolean => {
  try {
    const h = new URL(href).hostname.toLowerCase();
    return !SFL_HOSTS.some((d) => h === d || h.endsWith('.' + d)) &&
      !SFL_BLOG_HOSTS.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
};

const initReady = (): void => {
  if (!isAllowedHost(SFL_HOSTS) || !isReadyPath()) return;

  const tick = (): void => {
    if (started) return;
    const dest = destFromReadyPage();
    if (!dest || !isExternalDest(dest)) return;
    started = true;
    mountUi('Opening your link…');
    location.replace(dest);
  };

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
};

const initLanding = (): void => {
  if (!isAllowedHost(SFL_HOSTS) || !isAliasPath()) return;

  const tick = (): void => {
    if (started) return;
    const url = landingRedirectUrl();
    if (!url) return;
    started = true;
    requestVisibilitySpoof();
    mountUi('Skipping continue…');
    location.replace(url);
  };

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
};

const initBlog = (): void => {
  if (!isAllowedHost(SFL_BLOG_HOSTS)) return;
  if (!document.cookie.includes('__session=') && !document.cookie.includes('tt=')) return;

  const run = async (): Promise<void> => {
    if (started) return;
    started = true;
    requestVisibilitySpoof();
    const overlay = mountUi('Unlocking your link…');
    try {
      const dest = await unlockFromBlog();
      if (!isExternalDest(dest)) {
        overlay.setStatus('Opening next step…');
        location.replace(dest);
        return;
      }
      overlay.setStatus('Opening your link…');
      location.replace(dest);
    } catch (e) {
      overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
      if (e instanceof Error && e.message) overlay.setError(e.message);
      started = false;
    }
  };

  void run();
};

export function initSflGate(): void {
  if (window !== window.top) return;
  initReady();
  initLanding();
  initBlog();
}
