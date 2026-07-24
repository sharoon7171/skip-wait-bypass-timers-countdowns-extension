import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { CUTWIN_BLOG_HOSTS } from './hosts';
import { cutwinFlowFromPage, isCutwinBlogPage, postCutwinGetLink } from './unlock';

const OVERLAY_ID = 'skip-wait-cutwin-overlay';
const BOOT_STYLE_ID = 'skip-wait-cutwin-boot';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

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

const runUnlock = async (): Promise<void> => {
  const creds = cutwinFlowFromPage();
  if (!creds) throw new Error('cutwin gate');
  const overlay = mountUi('Unlocking your link…');
  const url = await postCutwinGetLink(location.href, creds.csrf, creds.flow);
  overlay.setStatus('Opening your link…');
  location.replace(url);
};

const kick = (): void => {
  if (started || !isCutwinBlogPage()) return;
  started = true;
  void runUnlock().catch(() => {
    mountUi().setError('Unlock failed. Reload and try again.');
    started = false;
  });
};

export function initCutwinGate(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(CUTWIN_BLOG_HOSTS)) return;

  const tick = (): void => {
    if (!isCutwinBlogPage()) return;
    bootOverlayLock();
    mountUi();
    kick();
  };

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    tick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
