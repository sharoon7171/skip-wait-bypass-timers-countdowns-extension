import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import {
  isCloudflareChallenge,
  isRinkuCaptchaGate,
  isRinkuCountdownGate,
  isRinkuLandPath,
  isRinkuOutPath,
  rinkuCaptchaForm,
  rinkuCaptchaWidget,
  rinkuHexForm,
  rinkuUnlockForm,
} from './detect';
import { MSG_RINKU_PAGE_HOOKS, RINKU_LAND_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-rinku-overlay';
const BOOT_STYLE_ID = 'skip-wait-rinku-boot';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-rinku-captcha-pin';
const CAPTCHA_WIDGET_ID = 'skip-wait-rinku-captcha';
const LAND_ONCE_KEY = 'skip-wait-rinku-land-once';
const OUT_ONCE_KEY = 'skip-wait-rinku-out-once';
const FORM_DONE = 'data-skip-wait-submitted';
const UNLOCK_MS = 15_000;
const CAPTCHA_IFRAMES = ['iframe[src*="turnstile"]'] as const;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Complete the check below. We’ll continue automatically when it’s done.',
} as const;

let ui: FullPageOverlay | null = null;
let landStarted = false;
let outStarted = false;
let captchaStarted = false;
let unlockStarted = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestHooks = (): void => {
  chrome.runtime.sendMessage({ type: MSG_RINKU_PAGE_HOOKS }).catch(() => {});
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const clearSiteTimers = (): void => {
  const highest = window.setTimeout(() => {}, 0);
  for (let i = 0; i <= highest; i++) {
    window.clearTimeout(i);
    window.clearInterval(i);
  }
};

const submitOnce = (form: HTMLFormElement): void => {
  if (form.getAttribute(FORM_DONE) === '1') return;
  clearSiteTimers();
  const action = form.getAttribute('action') ?? form.action;
  const method = form.getAttribute('method') ?? form.method;
  const fresh = form.cloneNode(true) as HTMLFormElement;
  form.setAttribute(FORM_DONE, '1');
  form.action = 'about:blank';
  form.remove();
  fresh.action = action;
  fresh.method = method;
  fresh.setAttribute(FORM_DONE, '1');
  (document.body || document.documentElement).appendChild(fresh);
  HTMLFormElement.prototype.submit.call(fresh);
};

const claimOnce = (key: string): boolean => {
  if (sessionStorage.getItem(key) === '1') return false;
  sessionStorage.setItem(key, '1');
  return true;
};

const bootOverlay = (): void => {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
};

const mountUi = (
  status: string,
  note: { lead: string; detail?: string } = NOTE,
): FullPageOverlay => {
  bootOverlay();
  if (ui) {
    ui.setNote(note);
    ui.setStatus(status);
    ui.setError(null);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note,
    status,
    countdownLabel: 'Your link opens in',
  });
  return ui;
};

const turnstileToken = (): string | null => {
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    '[name="cf-turnstile-response"]',
  );
  const v = el?.value?.trim() ?? '';
  return v.length > 20 ? v : null;
};

const runHexContinue = (kind: 'land' | 'out'): void => {
  const isLand = kind === 'land';
  if (isLand ? landStarted || !isRinkuLandPath() : outStarted || !isRinkuOutPath()) return;
  const form = rinkuHexForm();
  if (!form || form.getAttribute(FORM_DONE) === '1') return;
  if (!claimOnce(isLand ? LAND_ONCE_KEY : OUT_ONCE_KEY)) return;
  if (isLand) landStarted = true;
  else outStarted = true;
  mountUi(isLand ? 'Skipping land wait…' : 'Finishing exit hop…');
  if (isLand) document.getElementById('delulu-overlay')?.style.setProperty('display', 'none', 'important');
  clearSiteTimers();
  requestAnimationFrame(() => requestAnimationFrame(() => submitOnce(form)));
};

const runCaptchaGate = (): void => {
  if (captchaStarted || !isRinkuCaptchaGate()) return;
  const form = rinkuCaptchaForm();
  const widget = rinkuCaptchaWidget();
  if (!form || !widget) return;

  captchaStarted = true;
  requestHooks();
  const overlay = mountUi('Complete the captcha below.', CAPTCHA_NOTE);
  if (!widget.id) widget.id = CAPTCHA_WIDGET_ID;

  let stopPin: (() => void) | null = null;
  const pin = (): void => {
    if (stopPin) return;
    stopPin = pinSiteWidgetOverOverlay({
      overlayId: OVERLAY_ID,
      mount: overlay.turnstileMount,
      widgetId: widget.id,
      styleId: CAPTCHA_PIN_STYLE_ID,
      alsoVisibleSelectors: CAPTCHA_IFRAMES,
    });
  };
  pin();

  const tickCaptcha = (): void => {
    if (!document.contains(form)) {
      stopPin?.();
      captchaStarted = false;
      return;
    }
    pin();
    if (!turnstileToken()) {
      requestAnimationFrame(tickCaptcha);
      return;
    }
    stopPin?.();
    overlay.setNote(NOTE);
    overlay.setStatus('Continuing…');
    submitOnce(form);
  };
  requestAnimationFrame(tickCaptcha);
};

const runCountdownUnlock = async (): Promise<void> => {
  if (unlockStarted || !isRinkuCountdownGate()) return;
  const form = rinkuUnlockForm();
  if (!form || form.getAttribute(FORM_DONE) === '1') return;

  unlockStarted = true;
  requestHooks();
  const overlay = mountUi('Opening destination…');
  overlay.startCountdown(Date.now() + UNLOCK_MS);
  await sleep(UNLOCK_MS);
  overlay.hideCountdown();
  if (!document.contains(form)) return;

  form.style.setProperty('display', 'block', 'important');
  const count = document.getElementById('count');
  if (count) count.textContent = '0';
  document.getElementById('redirect-message')?.style.setProperty('display', 'none', 'important');
  document.getElementById('redirect-link')?.style.setProperty('display', 'block', 'important');
  submitOnce(form);
};

const tick = (): void => {
  if (isCloudflareChallenge()) return;
  if (isAllowedHost(RINKU_LAND_HOSTS) && isRinkuLandPath()) {
    runHexContinue('land');
    return;
  }
  if (isAllowedHost(RINKU_LAND_HOSTS) && isRinkuOutPath()) {
    runHexContinue('out');
    return;
  }
  if (isRinkuCaptchaGate()) {
    runCaptchaGate();
    return;
  }
  if (isRinkuCountdownGate()) void runCountdownUnlock();
};

export function initRinkuGate(): void {
  if (window !== window.top) return;
  if (isRinkuCountdownGate() || isRinkuCaptchaGate()) requestHooks();
  tick();
  new MutationObserver(tick).observe(document.documentElement, {
    attributeFilter: ['href', 'value', 'disabled', 'class', 'style'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, true);
  window.addEventListener('load', tick, true);
}
