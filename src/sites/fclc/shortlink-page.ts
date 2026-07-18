import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost } from '../../utils/domain-check';
import { MSG_FCLC_ALERT_SUPPRESS } from './alert-suppress';
import { FCLC_HOSTS } from './hosts';

const CAPTCHA_IN_FORM = '[name="h-captcha-response"], [name="g-recaptcha-response"]';
const HCAPTCHA_IFRAMES = [
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="newassets.hcaptcha.com"]',
] as const;
const HCAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Tap the checkbox below. We’ll continue automatically when it’s done.',
} as const;
const HCAPTCHA_PIN_STYLE_ID = 'skip-wait-fclc-hcaptcha-pin';
const HCAPTCHA_WIDGET_ID = 'skip-wait-fclc-hcaptcha';
const LINK_VIEW = '#link-view';
const OVERLAY_ID = 'skip-wait-fclc-overlay';
const READY_NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;
const SUBMIT_BTN = '#submitBtn';
const TURNSTILE_IFRAMES = [
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="turnstile"]',
] as const;
const TURNSTILE_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Complete the Turnstile check below. We’ll continue automatically when it’s done.',
} as const;
const TURNSTILE_PIN_STYLE_ID = 'skip-wait-fclc-turnstile-pin';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const TURNSTILE_WIDGET_ID = 'skip-wait-fclc-turnstile';
const VERIFICATION_FORMS = ['#verificationForm', '#verificationFormm'];

const TICK_MS = 100;
const SCROLL_EVERY = 5;
const MAX_TICKS = 600;

type PinPhase = {
  stopPin: (() => void) | null;
};

let ui: FullPageOverlay | null = null;

function hasNamedResponse(root: Element, selector: string): boolean {
  for (const el of root.querySelectorAll(selector)) {
    const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
    if (v?.length) return true;
  }
  return false;
}

function hasCfClearance(): boolean {
  return /\bcf_clearance=/.test(document.cookie);
}

function isCloudflareDone(form: Element): boolean {
  return hasNamedResponse(form, TURNSTILE_RESPONSE) || hasCfClearance();
}

function isCaptchaDone(form: Element): boolean {
  return hasNamedResponse(form, CAPTCHA_IN_FORM) || hasCfClearance();
}

function getVerificationForm(): HTMLFormElement | null {
  for (const sel of VERIFICATION_FORMS) {
    const el = document.querySelector<HTMLFormElement>(sel);
    if (el) return el;
  }
  return null;
}

function ensureWidgetId(el: HTMLElement, id: string): string {
  if (!el.id) el.id = id;
  return el.id;
}

function findHcaptchaWidget(form: Element): HTMLElement | null {
  return form.querySelector<HTMLElement>('.h-captcha');
}

function findTurnstileWidget(form: Element): HTMLElement | null {
  const byClass = form.querySelector<HTMLElement>('.cf-turnstile');
  if (byClass) return byClass;
  const box = form.querySelector<HTMLElement>('#captchaShortlink');
  if (box?.querySelector(`${TURNSTILE_RESPONSE}, iframe, .cf-turnstile`)) return box;
  const input = form.querySelector(TURNSTILE_RESPONSE);
  return input?.parentElement ?? null;
}

function mountUi(
  note: typeof HCAPTCHA_NOTE | typeof TURNSTILE_NOTE | typeof READY_NOTE,
  status: string,
): FullPageOverlay {
  if (ui) {
    ui.setNote(note);
    ui.setStatus(status);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note,
    status,
  });
  return ui;
}

function releasePin(phase: PinPhase): void {
  phase.stopPin?.();
  phase.stopPin = null;
}

function simulateActivity(form: HTMLFormElement): () => void {
  let n = 0;
  let tid = 0;
  const stop = (): void => {
    if (tid) clearInterval(tid);
    tid = 0;
  };
  tid = window.setInterval(() => {
    if (!document.contains(form) || n >= MAX_TICKS) {
      stop();
      return;
    }
    n++;
    const x = 80 + (n % 120);
    const y = 80 + ((n * 7) % 120);
    form.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
    if (n % SCROLL_EVERY === 0) {
      window.scrollBy(0, 1);
      window.scrollBy(0, -1);
    }
  }, TICK_MS);
  return stop;
}

function runCloudflarePart(form: HTMLFormElement): void {
  const phase: PinPhase = { stopPin: null };
  const overlay = mountUi(TURNSTILE_NOTE, 'Waiting for Turnstile…');
  const stopActivity = simulateActivity(form);
  let done = false;
  let btnObs: MutationObserver | null = null;

  const ensurePin = (): void => {
    if (done || phase.stopPin) return;
    const widget = findTurnstileWidget(form);
    if (!widget) return;
    const widgetId = ensureWidgetId(widget, TURNSTILE_WIDGET_ID);
    phase.stopPin = pinSiteWidgetOverOverlay({
      overlayId: OVERLAY_ID,
      mount: overlay.turnstileMount,
      widgetId,
      styleId: TURNSTILE_PIN_STYLE_ID,
      alsoVisibleSelectors: TURNSTILE_IFRAMES,
    });
  };

  const check = (): void => {
    if (done) return;
    ensurePin();
    const btn = document.querySelector<HTMLButtonElement>(SUBMIT_BTN);
    if (!btn) return;
    if (!btnObs) {
      btnObs = new MutationObserver(check);
      btnObs.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }
    if (!isCloudflareDone(form) || btn.disabled) return;
    done = true;
    stopActivity();
    obs.disconnect();
    btnObs?.disconnect();
    releasePin(phase);
    overlay.setNote(READY_NOTE);
    overlay.setStatus('Continuing…');
    requestAnimationFrame(() => btn.click());
  };

  const obs = new MutationObserver(check);
  obs.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  ensurePin();
  check();
}

function runHcaptchaPart(form: HTMLFormElement): void {
  const phase: PinPhase = { stopPin: null };
  const overlay = mountUi(HCAPTCHA_NOTE, 'Waiting for captcha…');
  let done = false;

  const ensurePin = (): void => {
    if (done || phase.stopPin) return;
    const widget = findHcaptchaWidget(form);
    if (!widget) return;
    const widgetId = ensureWidgetId(widget, HCAPTCHA_WIDGET_ID);
    phase.stopPin = pinSiteWidgetOverOverlay({
      overlayId: OVERLAY_ID,
      mount: overlay.turnstileMount,
      widgetId,
      styleId: HCAPTCHA_PIN_STYLE_ID,
      alsoVisibleSelectors: HCAPTCHA_IFRAMES,
    });
  };

  const check = (): void => {
    if (done) return;
    ensurePin();
    if (!isCaptchaDone(form)) return;
    done = true;
    obs.disconnect();
    releasePin(phase);
    overlay.setNote(READY_NOTE);
    overlay.setStatus('Continuing…');
    form.submit();
  };

  const obs = new MutationObserver(check);
  obs.observe(form, { childList: true, subtree: true, attributes: true });
  ensurePin();
  check();
}

export function initFclcShortlinkPage(): void {
  if (!isAllowedHost(FCLC_HOSTS)) return;

  let started = false;
  let mo: MutationObserver | null = null;

  const stop = (): void => {
    mo?.disconnect();
    mo = null;
  };

  const tryStart = (): void => {
    if (started) return;

    const linkView = document.querySelector<HTMLFormElement>(LINK_VIEW);
    if (linkView) {
      started = true;
      stop();
      chrome.runtime.sendMessage({ type: MSG_FCLC_ALERT_SUPPRESS }).catch(() => {});
      mountUi(READY_NOTE, 'Getting things ready…');
      runHcaptchaPart(linkView);
      return;
    }

    const verificationForm = getVerificationForm();
    if (!verificationForm) return;
    started = true;
    stop();
    chrome.runtime.sendMessage({ type: MSG_FCLC_ALERT_SUPPRESS }).catch(() => {});
    mountUi(READY_NOTE, 'Getting things ready…');
    runCloudflarePart(verificationForm);
  };

  tryStart();
  if (started) return;

  const root = document.documentElement;
  mo = new MutationObserver(tryStart);
  mo.observe(root, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        tryStart();
        if (!started) stop();
      },
      { once: true },
    );
  } else if (document.readyState === 'complete') {
    stop();
  }
}
