import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { LINKVERTISE_HOSTS } from './hosts';
import {
  isYourTargetPath,
  parseAccessIdentifier,
  readSuccessTarget,
  unlockAccessDestination,
  type SuccessTarget,
} from './unlock';

const OVERLAY_ID = 'skip-wait-linkvertise-access';
const BOOT_STYLE_ID = 'skip-wait-linkvertise-access-boot';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: 'Skip Wait is working. You don’t need to tap anything.',
} as const;

let ui: FullPageOverlay | null = null;
let started = false;
let finished = false;

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

const clearOverlayLock = (): void => {
  document.documentElement.classList.remove(overlayActiveClass(OVERLAY_ID));
  document.getElementById(BOOT_STYLE_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
  ui = null;
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

const isAccessPath = (): boolean =>
  /^\/access\/[^/]+\/[^/]+(?:\/dynamic)?\/?$/i.test(location.pathname);

const openDestination = (url: string, overlay: FullPageOverlay): void => {
  overlay.hideCountdown();
  overlay.setStatus('Opening your link…');
  location.replace(url);
};

const finishPaste = async (text: string, overlay: FullPageOverlay): Promise<void> => {
  overlay.hideCountdown();
  try {
    await navigator.clipboard.writeText(text);
    overlay.setStatus('Content copied — you can paste it anywhere.');
  } catch {
    overlay.setStatus('Your content is ready on the page.');
  }
  clearOverlayLock();
};

const applySuccessTarget = (ready: SuccessTarget, overlay: FullPageOverlay): void => {
  finished = true;
  if (ready.kind === 'url') {
    openDestination(ready.url, overlay);
    return;
  }
  void finishPaste(ready.text, overlay);
};

const runSuccessPage = (): void => {
  if (finished || !isYourTargetPath()) return;
  const ready = readSuccessTarget();
  if (!ready) return;

  started = true;
  const overlay = mountUi(
    ready.kind === 'url' ? 'Opening your link…' : 'Copying your content…',
  );
  applySuccessTarget(ready, overlay);
};

const runAccessPage = (): void => {
  if (started || finished || !isAccessPath()) return;
  const identifier = parseAccessIdentifier();
  if (!identifier) return;

  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Unlocking your link…');

  void unlockAccessDestination(identifier, {
    onStatus: (text) => {
      if (!finished) overlay.setStatus(text);
    },
    onWait: (endAt) => {
      if (!finished) overlay.startCountdown(endAt);
    },
    onWaitDone: () => overlay.hideCountdown(),
  })
    .then((ready) => {
      if (!finished) applySuccessTarget(ready, overlay);
    })
    .catch(() => {
      if (finished) return;
      const ready = readSuccessTarget();
      if (ready) {
        applySuccessTarget(ready, overlay);
        return;
      }
      overlay.hideCountdown();
      overlay.setStatus('Something went wrong — reload and try again.');
    });
};

const run = (): void => {
  if (finished) return;
  runSuccessPage();
  runAccessPage();
};

export function initLinkvertiseAccessPage(): void {
  if (!isAllowedHost(LINKVERTISE_HOSTS)) return;
  if (!isAccessPath() && !isYourTargetPath()) return;

  const tick = (): void => {
    if (finished) return;
    if (!started) {
      mountUi(isYourTargetPath() ? 'Almost there…' : 'Getting ready…');
    }
    run();
  };

  tick();
  if (finished) return;

  const mo = new MutationObserver(() => {
    tick();
    if (finished) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  let polls = 0;
  const poll = window.setInterval(() => {
    polls += 1;
    tick();
    if (finished || polls >= 80) window.clearInterval(poll);
  }, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
