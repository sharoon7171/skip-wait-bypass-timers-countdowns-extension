import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { MOVE2LINK_BLOG_HOSTS, MOVE2LINK_GO_HOSTS } from './hosts';
import { decodeGoToParam, sessionToken, unlockDestination } from './unlock';

const OVERLAY_ID = 'skip-wait-move2link-overlay';
const BOOT_STYLE_ID = 'skip-wait-move2link-boot';

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
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
    countdownLabel: 'Continue in',
  });
  return ui;
};

const runBlogUnlock = async (): Promise<void> => {
  const token = sessionToken();
  if (!token) throw new Error('token');
  mountUi('Opening destination…');
  requestVisibilitySpoof();
  location.replace(await unlockDestination(token));
};

const kickBlog = (): void => {
  if (started || !sessionToken()) return;
  started = true;
  void runBlogUnlock().catch(() => {
    mountUi().setError('Unlock failed. Reload and try again.');
    started = false;
  });
};

const initBlogGate = (): void => {
  if (!isAllowedHost(MOVE2LINK_BLOG_HOSTS)) return;

  const tick = (): void => {
    if (!sessionToken()) return;
    bootOverlayLock();
    mountUi();
    kickBlog();
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
};

const initGoGate = (): void => {
  if (!isAllowedHost(MOVE2LINK_GO_HOSTS)) return;
  try {
    const to = new URL(location.href).searchParams.get('to');
    const dest = to ? decodeGoToParam(to) : null;
    if (dest) location.replace(dest);
  } catch {}
};

export function initMove2linkGate(): void {
  initGoGate();
  initBlogGate();
}
