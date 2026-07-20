import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { LINKVERTISE_HOSTS } from './hosts';
import { parseAccessIdentifier, unlockAccessDestination } from './unlock';

const OVERLAY_ID = 'skip-wait-linkvertise-access';
const BOOT_STYLE_ID = 'skip-wait-linkvertise-access-boot';

const NOTE = {
  lead: 'Unlocking Linkvertise…',
  detail: 'Skip Wait completes access tasks over GraphQL.',
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

const mountUi = (status = 'Getting ready…'): FullPageOverlay => {
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

const isAccessPath = (): boolean => /^\/access\/[^/]+\/[^/]+\/?$/i.test(location.pathname);

const run = (): void => {
  if (started || !isAccessPath()) return;
  const identifier = parseAccessIdentifier();
  if (!identifier) return;

  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Starting GraphQL unlock…');

  void unlockAccessDestination(identifier, {
    onStatus: (text) => overlay.setStatus(text),
    onWait: (endAt) => overlay.startCountdown(endAt),
    onWaitDone: () => overlay.hideCountdown(),
  })
    .then((url) => {
      overlay.hideCountdown();
      overlay.setStatus('Opening destination…');
      location.replace(url);
    })
    .catch(() => {
      overlay.hideCountdown();
      overlay.setStatus('Unlock failed — reload and try again.');
      started = false;
    });
};

export function initLinkvertiseAccessPage(): void {
  if (!isAllowedHost(LINKVERTISE_HOSTS)) return;
  if (!isAccessPath()) return;

  const tick = (): void => {
    mountUi();
    run();
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
