import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../adlinkfly/unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { TFLY_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-tfly-overlay';
const BOOT_STYLE_ID = 'skip-wait-tfly-boot';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-tfly-captcha-pin';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const CAPTCHA_RESPONSE = '[name="h-captcha-response"], [name="g-recaptcha-response"]';
const HCAPTCHA_IFRAMES = [
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="newassets.hcaptcha.com"]',
] as const;
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Tap the checkbox below. We’ll continue automatically when it’s done.',
} as const;

let ui: FullPageOverlay | null = null;
let continueStarted = false;
let captchaStarted = false;
let unlockStarted = false;

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

const mountUi = (
  note: typeof NOTE | typeof CAPTCHA_NOTE = NOTE,
  status = 'Getting things ready…',
): FullPageOverlay => {
  bootOverlayLock();
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

const isAliasPath = (): boolean => {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return parts.length === 1 && ALIAS_RE.test(parts[0]!);
};

const isRealUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const continueForm = (): HTMLFormElement | null =>
  document.querySelector<HTMLFormElement>('#form-continue');

const captchaForm = (): HTMLFormElement | null => {
  const form = document.querySelector<HTMLFormElement>('#link-view');
  if (!form) return null;
  if (!form.querySelector(`#${CAPTCHA_WIDGET_ID}`) && !form.querySelector(CAPTCHA_RESPONSE)) {
    return null;
  }
  return form;
};

const isUnlockShell = (): boolean =>
  Boolean(
    document.querySelector('#go-link, form[action*="/links/go"]') &&
      document.querySelector('input[name="ad_form_data"]'),
  );

const counterSec = (): number => {
  const page = document.documentElement.innerHTML;
  const m = page.match(/["']counter_value["']\s*:\s*["']?(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer, #counter');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const hasCaptchaToken = (form: HTMLFormElement): boolean => {
  for (const root of [form, document]) {
    for (const el of root.querySelectorAll(CAPTCHA_RESPONSE)) {
      const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
      if (v && v.length > 20) return true;
    }
  }
  return false;
};

const runContinue = (): boolean => {
  if (continueStarted) return true;
  const form = continueForm();
  if (!form) return false;
  continueStarted = true;
  requestVisibilitySpoof();
  const page = form.querySelector<HTMLInputElement>('input[name="page"]')?.value?.trim();
  mountUi(NOTE, page ? `Skipping step ${page}…` : 'Skipping continue page…');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => form.submit());
  });
  return true;
};

const runCaptcha = (): boolean => {
  if (captchaStarted) return true;
  const form = captchaForm();
  if (!form) return false;
  captchaStarted = true;
  requestVisibilitySpoof();
  const overlay = mountUi(CAPTCHA_NOTE, 'Waiting for captcha…');
  let stopPin: (() => void) | null = null;
  let done = false;
  let raf = 0;

  const pin = (): void => {
    if (done || stopPin) return;
    if (!document.getElementById(CAPTCHA_WIDGET_ID)) return;
    stopPin = pinSiteWidgetOverOverlay({
      overlayId: OVERLAY_ID,
      mount: overlay.turnstileMount,
      widgetId: CAPTCHA_WIDGET_ID,
      styleId: CAPTCHA_PIN_STYLE_ID,
      alsoVisibleSelectors: HCAPTCHA_IFRAMES,
    });
  };

  const submitCaptcha = (): void => {
    const btn = form.querySelector<HTMLButtonElement>(
      '#invisibleCaptchaShortlink, button.btn-captcha, button[type="submit"]',
    );
    if (btn) {
      btn.disabled = false;
      btn.removeAttribute('disabled');
      btn.click();
      return;
    }
    form.submit();
  };

  const finish = (): void => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    obs.disconnect();
    stopPin?.();
    stopPin = null;
    overlay.setNote(NOTE);
    overlay.setStatus('Continuing…');
    submitCaptcha();
  };

  const tick = (): void => {
    if (done) return;
    if (!document.contains(form)) {
      done = true;
      cancelAnimationFrame(raf);
      obs.disconnect();
      stopPin?.();
      return;
    }
    pin();
    if (hasCaptchaToken(form)) {
      finish();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const obs = new MutationObserver(() => {
    if (!done) tick();
  });
  obs.observe(form, { attributeFilter: ['value', 'disabled'], attributes: true, childList: true, subtree: true });
  pin();
  raf = requestAnimationFrame(tick);
  return true;
};

const runUnlock = async (): Promise<void> => {
  if (unlockStarted || !isUnlockShell()) return;
  unlockStarted = true;
  requestVisibilitySpoof();
  const overlay = mountUi(NOTE, 'Getting things ready…');

  const sec = counterSec();
  if (sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + sec * 1000);
    await sleep(sec * 1000);
    overlay.hideCountdown();
  }

  if (!isUnlockShell()) {
    unlockStarted = false;
    return;
  }

  revealTimerLinks();
  const existing = document.querySelector<HTMLAnchorElement>('a.get-link, #gt-link');
  if (existing?.href && isRealUrl(existing.href)) {
    overlay.setStatus('Opening your link…');
    location.replace(existing.href);
    return;
  }

  overlay.setStatus('Unlocking your link…');
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) {
    overlay.setStatus('This page isn’t ready yet. Reload and try again.');
    unlockStarted = false;
    return;
  }

  let url = await postLinksGo(form, location.href);
  if (!url && sec > 0) {
    overlay.setStatus('Waiting for the short timer…');
    overlay.startCountdown(Date.now() + (sec + 2) * 1000);
    const endAt = Date.now() + (sec + 2) * 1000;
    while (!url && Date.now() < endAt) {
      revealTimerLinks();
      url = await postLinksGo(form, location.href);
      if (url) break;
      await sleep(200);
    }
    overlay.hideCountdown();
  }

  if (!url) {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    unlockStarted = false;
    return;
  }

  overlay.setStatus('Opening your link…');
  location.replace(url);
};

const tick = (): void => {
  if (runContinue()) return;
  if (runCaptcha()) return;
  if (isUnlockShell()) {
    void runUnlock();
    return;
  }
  mountUi(NOTE, 'Getting things ready…');
};

export function initTflyGate(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(TFLY_HOSTS)) return;
  if (!isAliasPath()) return;

  bootOverlayLock();
  mountUi(NOTE, 'Getting things ready…');
  tick();

  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, {
    attributeFilter: ['href', 'value', 'disabled'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
