import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { EXEIO_HOSTS, MSG_EXEIO_ADBLOCK } from './hosts';
import {
  counterSecFromPage,
  submitGoLinkNative,
} from './unlock';

const OVERLAY_ID = 'skip-wait-exeio-overlay';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-exeio-captcha-pin';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const TURNSTILE_IFRAMES = [
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="turnstile"]',
] as const;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Complete the Turnstile check below. We’ll continue automatically when it’s done.',
} as const;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type PinPhase = {
  stopPin: (() => void) | null;
};

let ui: FullPageOverlay | null = null;
let started = false;

const requestAdblockBypass = (): void => {
  chrome.runtime.sendMessage({ type: MSG_EXEIO_ADBLOCK }).catch(() => {});
};

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const mountUi = (
  note: typeof NOTE | typeof CAPTCHA_NOTE = NOTE,
  status = 'Getting things ready…',
): FullPageOverlay => {
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
    countdownLabel: 'Continue in',
  });
  return ui;
};

const releasePin = (phase: PinPhase): void => {
  phase.stopPin?.();
  phase.stopPin = null;
};

const isExeioShell = (): boolean => {
  if (document.querySelector('#before-captcha, #link-view, #go-link')) return true;
  const av = (window as unknown as { app_vars?: { base_url?: string; current_url?: string } }).app_vars;
  const base = `${av?.base_url ?? ''}${av?.current_url ?? ''}`.toLowerCase();
  return /exe\.io|exeygo\.com/.test(base);
};

const hasTurnstileToken = (root: ParentNode = document): string | null => {
  for (const el of root.querySelectorAll(TURNSTILE_RESPONSE)) {
    const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
    if (v && v.length > 20) return v;
  }
  return null;
};

const hasTurnstileFrame = (root: ParentNode = document): boolean =>
  TURNSTILE_IFRAMES.some((sel) => !!root.querySelector(sel));

const ensureWidgetId = (el: HTMLElement, id: string): string => {
  if (!el.id) el.id = id;
  return el.id;
};

const findTurnstileWidget = (form: Element): HTMLElement | null => {
  const box = form.querySelector<HTMLElement>(`#${CAPTCHA_WIDGET_ID}`);
  if (box) return box;
  const byClass = form.querySelector<HTMLElement>('.cf-turnstile');
  if (byClass) return byClass;
  const input = form.querySelector(TURNSTILE_RESPONSE);
  return input?.parentElement ?? null;
};

const waitFor = async <T>(
  pick: () => T | null | undefined | false,
  timeoutMs: number,
  everyMs = 100,
): Promise<T | null> => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = pick();
    if (v) return v as T;
    await sleep(everyMs);
  }
  const last = pick();
  return last ? (last as T) : null;
};

const submitForm = (form: HTMLFormElement): void => {
  form.submit();
};

const putTokenOnForm = (form: HTMLFormElement, token: string): void => {
  const fn = form.querySelector<HTMLInputElement>('[name=f_n]');
  if (fn) fn.value = 'slc';
  let input = form.querySelector<HTMLInputElement>(TURNSTILE_RESPONSE);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    form.appendChild(input);
  }
  input.value = token;
};

async function runBeforeCaptcha(overlay: FullPageOverlay): Promise<boolean> {
  let form = document.getElementById('before-captcha') as HTMLFormElement | null;
  if (!form?.querySelector('[name=_csrfToken]') && !form?.querySelector('.button.disabled.danger')) {
    return false;
  }

  if (form.querySelector('.button.disabled.danger') && !form.querySelector('[name=f_n]')) {
    overlay.setStatus('Bypassing adblock gate…');
    requestAdblockBypass();
    form = await waitFor(() => {
      const f = document.getElementById('before-captcha') as HTMLFormElement | null;
      return f?.querySelector('[name=f_n]') ? f : null;
    }, 8_000);
    if (!form) {
      overlay.setError('Adblock gate still active. Reload and try again.');
      return true;
    }
  }

  if (!form.querySelector('[name=_csrfToken]')) return false;

  const fn = form.querySelector<HTMLInputElement>('[name=f_n]');
  if (fn) fn.value = 'sle';

  overlay.setNote(NOTE);
  overlay.setStatus('Skipping continue gate…');
  submitForm(form);
  return true;
}

function runLinkViewCaptcha(overlay: FullPageOverlay): Promise<string | null> {
  return new Promise((resolve) => {
    const phase: PinPhase = { stopPin: null };
    let done = false;
    let finishing = false;
    let pinAt = 0;

    const liveForm = (): HTMLFormElement | null =>
      document.getElementById('link-view') as HTMLFormElement | null;

    const finish = (token: string | null): void => {
      if (done) return;
      done = true;
      window.clearInterval(burst);
      obs.disconnect();
      resolve(token);
      window.setTimeout(() => releasePin(phase), 0);
    };

    const ensurePin = (): void => {
      if (done) return;
      const form = liveForm();
      if (!form) {
        if (document.querySelector('.button.disabled.danger')) {
          overlay.setStatus('Bypassing adblock gate…');
          requestAdblockBypass();
        }
        return;
      }
      const widget = findTurnstileWidget(form);
      if (!widget) return;
      const widgetId = ensureWidgetId(widget, CAPTCHA_WIDGET_ID);
      if (phase.stopPin && document.getElementById(widgetId)) return;
      releasePin(phase);
      phase.stopPin = pinSiteWidgetOverOverlay({
        overlayId: OVERLAY_ID,
        mount: overlay.turnstileMount,
        widgetId,
        styleId: CAPTCHA_PIN_STYLE_ID,
        alsoVisibleSelectors: TURNSTILE_IFRAMES,
      });
      if (!pinAt) pinAt = Date.now();
      if (hasTurnstileFrame(form) || hasTurnstileFrame(document)) {
        overlay.setStatus('Complete the captcha below.');
      } else {
        overlay.setStatus('Loading captcha…');
      }
    };

    const check = (): void => {
      if (done || finishing) return;
      ensurePin();
      if (!phase.stopPin) return;
      const form = liveForm();
      if (hasTurnstileFrame(form ?? document) || hasTurnstileFrame(document)) {
        overlay.setStatus('Complete the captcha below.');
      }
      const token =
        (form ? hasTurnstileToken(form) : null) ?? hasTurnstileToken(document);
      if (!token) return;
      if (Date.now() - pinAt < 400) return;
      finishing = true;
      overlay.setStatus('Captcha verified…');
      window.setTimeout(() => finish(token), 300);
    };

    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    ensurePin();
    check();
    const burst = window.setInterval(check, 250);
    window.setTimeout(() => {
      if (done) return;
      const form = liveForm();
      finish((form ? hasTurnstileToken(form) : null) ?? hasTurnstileToken(document));
    }, 180_000);
  });
}

async function runLinkView(overlay: FullPageOverlay): Promise<boolean> {
  if (!document.getElementById('link-view') && !document.querySelector('.button.disabled.danger')) {
    return false;
  }

  overlay.setNote(CAPTCHA_NOTE);
  overlay.setStatus('Waiting for captcha…');
  requestAdblockBypass();

  const token = await runLinkViewCaptcha(overlay);
  if (!token) {
    overlay.setError('Turnstile was not completed. Finish the check above.');
    return true;
  }

  const form = document.getElementById('link-view') as HTMLFormElement | null;
  if (!form) {
    overlay.setError('Captcha form was removed. Reload and try again.');
    return true;
  }

  putTokenOnForm(form, token);
  overlay.setNote(NOTE);
  overlay.setStatus('Submitting captcha…');
  submitForm(form);
  return true;
}

async function runGoLink(overlay: FullPageOverlay): Promise<boolean> {
  const form = document.getElementById('go-link') as HTMLFormElement | null;
  if (!form?.querySelector('[name=ad_form_data]')) return false;

  overlay.setNote(NOTE);
  requestVisibilitySpoof();

  const sec = counterSecFromPage();
  if (sec > 0) {
    overlay.setStatus('Waiting for unlock timer…');
    const endAt = Date.now() + sec * 1000;
    overlay.startCountdown(endAt);
    await sleep(Math.max(0, endAt - Date.now()));
    overlay.hideCountdown();
  }

  overlay.setStatus('Opening destination…');
  const live = document.getElementById('go-link') as HTMLFormElement | null;
  if (!live?.querySelector('[name=ad_form_data]')) {
    overlay.setError('Unlock form was removed. Reload and try again.');
    return true;
  }
  submitGoLinkNative(live);
  return true;
}

async function runPipeline(): Promise<void> {
  requestAdblockBypass();
  const overlay = mountUi(NOTE, 'Getting things ready…');

  if (await runGoLink(overlay)) return;
  if (document.getElementById('link-view') || document.querySelector('.link-container .button.disabled.danger')) {
    await runLinkView(overlay);
    return;
  }
  if (document.getElementById('before-captcha')) {
    await runBeforeCaptcha(overlay);
    return;
  }

  await waitFor(
    () =>
      document.getElementById('before-captcha') ||
      document.getElementById('link-view') ||
      document.getElementById('go-link'),
    15_000,
  );

  if (await runGoLink(overlay)) return;
  if (document.getElementById('link-view') || document.querySelector('.link-container .button.disabled.danger')) {
    await runLinkView(overlay);
    return;
  }
  if (!(await runBeforeCaptcha(overlay))) {
    overlay.setError('exe.io gate not found on this page.');
  }
}

export function initExeioGate(): void {
  if (!isAllowedHost(EXEIO_HOSTS)) return;

  requestAdblockBypass();

  const tryStart = (): void => {
    if (started || !isExeioShell()) return;
    started = true;
    mountUi(NOTE, 'Getting things ready…');
    void runPipeline();
  };

  tryStart();
  if (started) return;

  const root = document.documentElement;
  let mo: MutationObserver | null = null;
  const stop = (): void => {
    mo?.disconnect();
    mo = null;
  };
  mo = new MutationObserver(() => {
    tryStart();
    if (started) stop();
  });
  mo.observe(root, { childList: true, subtree: true });
  whenDomParsed(() => {
    tryStart();
    if (!started && document.readyState === 'complete') stop();
  });
}
