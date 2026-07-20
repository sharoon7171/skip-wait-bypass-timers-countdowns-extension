import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../adlinkfly/unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { ICUTLINK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-icutlink-links-go';
const BOOT_STYLE_ID = 'skip-wait-icutlink-links-go-boot';
const GO_FORM = '#go-link, form[action*="/links/go"]';
const GET_LINK = 'a.get-link';

const NOTE = {
  lead: 'Opening destination…',
  detail: 'Skip Wait posts /links/go now — no client timer wait.',
} as const;

let ui: FullPageOverlay | null = null;
let started = false;
let covered = false;

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

const counterSec = (): number => {
  const html = document.documentElement.innerHTML;
  const fromVars = html.match(/app_vars\[['\"]counter_value['\"]\]\s*=\s*['\"](\d+)['\"]/);
  if (fromVars?.[1]) return Math.max(0, parseInt(fromVars[1], 10));
  const fromJson = html.match(/"counter_value"\s*:\s*(\d+)/);
  if (fromJson?.[1]) return Math.max(0, parseInt(fromJson[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer, #counter');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
};

const mountUi = (status = 'Unlocking…'): FullPageOverlay => {
  bootOverlayLock();
  covered = true;
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
    countdownLabel: 'Site timer',
  });
  return ui;
};

const isCaptchaGate = (): boolean => {
  if (document.querySelector('.captcha-buttons, #captcha-buttons')) return true;
  const text = document.body?.innerText ?? '';
  return /Select number\s+\d+/i.test(text) || /Loading challenge/i.test(text);
};

const isGoShell = (): boolean => !!document.querySelector(GO_FORM) || !!document.querySelector(GET_LINK);

const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const unlock = async (): Promise<string | null> => {
  revealTimerLinks();
  const ready = document.querySelector<HTMLAnchorElement>(GET_LINK);
  if (ready?.href && isHttpUrl(ready.href)) return ready.href;

  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) return null;
  return postLinksGo(form, location.href);
};

const coverIfGo = (): void => {
  if (covered || isCaptchaGate() || !isGoShell()) return;
  const overlay = mountUi('Posting /links/go…');
  const sec = counterSec();
  if (sec > 0) overlay.startCountdown(Date.now() + sec * 1000);
};

const run = (): void => {
  if (started || isCaptchaGate() || !isGoShell()) return;
  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Posting /links/go…');
  const sec = counterSec();
  if (sec > 0) overlay.startCountdown(Date.now() + sec * 1000);

  void unlock()
    .then((url) => {
      if (!url) {
        overlay.hideCountdown();
        overlay.setStatus('Unlock failed — reload and try again.');
        started = false;
        return;
      }
      overlay.hideCountdown();
      overlay.setStatus('Redirecting…');
      location.replace(url);
    })
    .catch(() => {
      overlay.hideCountdown();
      overlay.setStatus('Something went wrong — reload and try again.');
      started = false;
    });
};

export function initIcutlinkLinksGo(): void {
  if (!isAllowedHost(ICUTLINK_HOSTS)) return;

  const tryStart = (): void => {
    if (isCaptchaGate()) return;
    coverIfGo();
    if (!isGoShell()) return;
    run();
  };

  tryStart();
  if (started) return;

  const mo = new MutationObserver(() => {
    tryStart();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryStart, true);
  }
}
