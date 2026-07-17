import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from './unlock';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost } from '../../utils/domain-check';

const HOSTS = ['linkjust.com', 'pahe.plus'] as const;
const OVERLAY_ID = 'skip-wait-adlinkfly-overlay';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-adlinkfly-captcha-pin';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const LINKS_GO_SHELL_SEL = '#link-view,#go-link,form[action*="/links/go"],a.get-link';
const CAPTCHA_RESPONSE = '[name="g-recaptcha-response"], [name="h-captcha-response"]';
const HCAPTCHA_IFRAMES = [
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="newassets.hcaptcha.com"]',
] as const;
const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;
const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Tap the checkbox below. We’ll continue automatically when it’s done.',
} as const;

type CaptchaPhase = {
  started: boolean;
  done: boolean;
  stopPin: (() => void) | null;
};

const isRealUrl = (s: string): boolean => s.startsWith('http://') || s.startsWith('https://');

let ui: FullPageOverlay | null = null;

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const dropUi = (): void => {
  ui?.remove();
  ui = null;
};

const exitCaptchaPhase = (phase: CaptchaPhase): void => {
  phase.stopPin?.();
  phase.stopPin = null;
  dropUi();
  phase.done = true;
};

const counterSec = (): number => {
  const html = document.documentElement.innerHTML;
  const m = html.match(/"counter_value"\s*:\s*(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer, #counter');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const mountUi = (): FullPageOverlay => {
  if (ui) return ui;
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status: 'Getting things ready…',
    countdownLabel: 'Your link opens in',
  });
  return ui;
};

const postFromPage = (): Promise<string | null> => {
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, location.href);
  if (!form) return Promise.resolve(null);
  return postLinksGo(form, location.href);
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const finishTimerUnlock = async (overlay: FullPageOverlay): Promise<string | null> => {
  revealTimerLinks();
  const link = document.querySelector<HTMLAnchorElement>('a.get-link');
  if (link?.href && isRealUrl(link.href)) return link.href;

  let url = await postFromPage();
  if (url) return url;

  const sec = counterSec();
  if (sec > 0) {
    requestVisibilitySpoof();
    overlay.setStatus('Waiting for timer…');
    overlay.startCountdown(Date.now() + sec * 1000);
    const endAt = Date.now() + (sec + 2) * 1000;
    while (Date.now() < endAt) {
      revealTimerLinks();
      url = await postFromPage();
      if (url) return url;
      await sleep(200);
    }
  }

  revealTimerLinks();
  return postFromPage();
};

const redirectTo = (url: string): void => {
  mountUi().setStatus('Redirecting now…');
  location.href = url;
};

const isAdlinkflyLinksGoShell = (doc: Document = document): boolean =>
  !!doc.querySelector(LINKS_GO_SHELL_SEL);

const captchaForm = (): HTMLFormElement | null => {
  const form = document.getElementById('link-view') as HTMLFormElement | null;
  if (!form?.querySelector(CAPTCHA_RESPONSE)) return null;
  return form;
};

const hasLinksGoHint = (): boolean => {
  if (isAdlinkflyLinksGoShell()) return true;
  for (const s of document.scripts) {
    if (s.textContent?.includes('/links/go')) return true;
  }
  return false;
};

const runWhenNotLoading = (run: () => void): void => {
  if (document.readyState !== 'loading') run();
  else
    document.addEventListener('readystatechange', function onReady() {
      if (document.readyState === 'loading') return;
      document.removeEventListener('readystatechange', onReady);
      run();
    });
};

const hasCaptchaToken = (form: HTMLFormElement): boolean => {
  for (const el of form.querySelectorAll(CAPTCHA_RESPONSE)) {
    const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
    if (v && v.length > 20) return true;
  }
  return false;
};

const runCaptchaPhase = (form: HTMLFormElement, phase: CaptchaPhase): void => {
  if (phase.started || phase.done) return;
  phase.started = true;

  const overlay = mountUi();
  overlay.setNote(CAPTCHA_NOTE);
  overlay.setStatus('Waiting for captcha…');

  if (document.getElementById(CAPTCHA_WIDGET_ID)) {
    phase.stopPin = pinSiteWidgetOverOverlay({
      overlayId: OVERLAY_ID,
      mount: overlay.turnstileMount,
      widgetId: CAPTCHA_WIDGET_ID,
      styleId: CAPTCHA_PIN_STYLE_ID,
      alsoVisibleSelectors: HCAPTCHA_IFRAMES,
    });
  }

  const tick = (): void => {
    if (phase.done) return;
    if (!document.contains(form)) {
      exitCaptchaPhase(phase);
      return;
    }
    if (!hasCaptchaToken(form)) {
      requestAnimationFrame(tick);
      return;
    }
    exitCaptchaPhase(phase);
    form.submit();
  };
  requestAnimationFrame(tick);
};

const runTimerPhase = async (state: { done: boolean; inFlight: boolean }): Promise<boolean> => {
  if (state.done || state.inFlight) return state.done;

  const link = document.querySelector<HTMLAnchorElement>('a.get-link');
  if (link?.href && isRealUrl(link.href)) {
    state.done = true;
    redirectTo(link.href);
    return true;
  }

  const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
  if (!form) return false;

  state.inFlight = true;
  try {
    const overlay = mountUi();
    overlay.setNote(NOTE);
    const url = await finishTimerUnlock(overlay);
    if (!url) return false;
    state.done = true;
    redirectTo(url);
    return true;
  } finally {
    state.inFlight = false;
  }
};

const startAdlinkflyLinksGo = (): void => {
  requestVisibilitySpoof();
  const captchaPhase: CaptchaPhase = { started: false, done: false, stopPin: null };
  const timerState = { done: false, inFlight: false };
  let finished = false;

  const run = (): void => {
    if (finished) return;
    const captcha = captchaForm();
    if (captcha) {
      runCaptchaPhase(captcha, captchaPhase);
      return;
    }
    void runTimerPhase(timerState).then((ok) => {
      if (ok) finished = true;
    });
  };

  const observer = new MutationObserver(run);
  run();
  observer.observe(document.documentElement, {
    attributeFilter: ['href', 'value'],
    attributes: true,
    childList: true,
    subtree: true,
  });
  let micro = 0;
  const microBurst = (): void => {
    if (finished) return;
    run();
    if (++micro < 48) queueMicrotask(microBurst);
  };
  queueMicrotask(microBurst);
  let frames = 0;
  const rafLoop = (): void => {
    if (finished) return;
    run();
    if (++frames < 960) requestAnimationFrame(rafLoop);
  };
  requestAnimationFrame(rafLoop);
};

export function initAdlinkflyLinksGo(): void {
  if (!isAllowedHost(HOSTS)) return;
  if (hasLinksGoHint()) requestVisibilitySpoof();
  let engaged = false;
  const tryStart = (): void => {
    if (engaged || !isAdlinkflyLinksGoShell()) return;
    engaged = true;
    startAdlinkflyLinksGo();
  };
  tryStart();
  if (engaged) return;
  if (document.readyState === 'complete') return;
  if (document.readyState === 'interactive' && !hasLinksGoHint()) return;
  const root = document.documentElement;
  if (!root) return void runWhenNotLoading(tryStart);

  let mo: MutationObserver | null = null;
  const onReadyState = (): void => {
    if (document.readyState === 'loading') return;
    tryStart();
    if (engaged) return stop();
    if (document.readyState === 'interactive' && !hasLinksGoHint()) stop();
    else if (document.readyState === 'complete') stop();
  };
  const stop = (): void => {
    mo?.disconnect();
    mo = null;
    document.removeEventListener('readystatechange', onReadyState);
  };
  mo = new MutationObserver(() => {
    tryStart();
    if (engaged) stop();
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('readystatechange', onReadyState);
  onReadyState();
}
