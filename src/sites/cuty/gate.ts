import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { overlayActiveClass, buildFullPageOverlayCss } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { CUTY_HOSTS, MSG_CUTY_ADBLOCK } from './hosts';
import {
  countdownSecFromHtml,
  csrfFromHtml,
  cutyAliasFromPath,
  goDataFromHtml,
  isCutyGatePath,
} from './unlock';

const OVERLAY_ID = 'skip-wait-cuty-overlay';
const BOOT_STYLE_ID = 'skip-wait-cuty-boot';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-cuty-captcha-pin';
const TURNSTILE_WIDGET_ID = 'turnstile-container';
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

type PinPhase = { stopPin: (() => void) | null };

let ui: FullPageOverlay | null = null;
let started = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const requestAdblockBypass = (): void => {
  chrome.runtime.sendMessage({ type: MSG_CUTY_ADBLOCK }).catch(() => {});
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
  return (pick() as T) || null;
};

const freeForm = (): HTMLFormElement | null =>
  document.querySelector<HTMLFormElement>('#free-submit-form');

const gateRef = (): string | null =>
  document.querySelector<HTMLElement>('[data-ref]')?.getAttribute('data-ref') ?? null;

const goForm = (): HTMLFormElement | null => {
  const form = document.querySelector<HTMLFormElement>('#submit-form');
  if (!form) return null;
  const action = form.getAttribute('action') || form.action || '';
  if (/\/go\//i.test(action) || form.querySelector('[name="data"]')) return form;
  return null;
};

const isLastStep = (): boolean =>
  gateRef() === 'show' ||
  !!goForm()?.querySelector('[name="data"]') ||
  typeof (window as unknown as { countdownValue?: number }).countdownValue === 'number';

const isCaptchaStep = (form: HTMLFormElement): boolean =>
  gateRef() === 'captcha' ||
  !!form.querySelector(`#${TURNSTILE_WIDGET_ID}, .cf-turnstile, ${TURNSTILE_RESPONSE}`) ||
  form.querySelector<HTMLElement>('#submit-button')?.dataset?.['ref'] === 'captcha';

const turnstileToken = (root: ParentNode = document): string | null => {
  for (const sel of [
    TURNSTILE_RESPONSE,
    'textarea[name="cf-turnstile-response"]',
    'input[id^="cf-chl-widget"][id$="_response"]',
  ]) {
    for (const el of root.querySelectorAll(sel)) {
      const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
      if (v && v.length > 20) return v;
    }
  }
  return null;
};

const hasTurnstileFrame = (root: ParentNode = document): boolean =>
  !!root.querySelector(
    'iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]',
  );

const liveCountdownSec = (): number => {
  const live = (window as unknown as { countdownValue?: number }).countdownValue;
  if (typeof live === 'number' && live >= 0) return live;
  return countdownSecFromHtml(document.documentElement.innerHTML);
};

const lastPayload = (): { form: HTMLFormElement; data: string; token: string; sec: number } | null => {
  const form = goForm();
  const html = document.documentElement.innerHTML;
  const data = form?.querySelector<HTMLInputElement>('[name="data"]')?.value || goDataFromHtml(html);
  const token =
    form?.querySelector<HTMLInputElement>('[name="_token"]')?.value || csrfFromHtml(html) || csrfLive();
  if (!form || !data || !token) return null;
  return { form, data, token, sec: liveCountdownSec() };
};

const lastPayloadReady = (hit: NonNullable<ReturnType<typeof lastPayload>>): boolean => {
  const live = (window as unknown as { countdownValue?: number }).countdownValue;
  if (typeof live === 'number') return true;
  if (hit.sec > 0) return true;
  return /countdownValue\s*=\s*\d+/.test(document.documentElement.innerHTML);
};

const waitLastPayload = async (): Promise<{ form: HTMLFormElement; data: string; token: string; sec: number } | null> =>
  waitFor(() => {
    const hit = lastPayload();
    return hit && lastPayloadReady(hit) ? hit : null;
  }, 30_000, 100);

const putTokenOnForm = (form: HTMLFormElement, token: string): void => {
  let input = form.querySelector<HTMLInputElement>(TURNSTILE_RESPONSE);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'cf-turnstile-response';
    form.appendChild(input);
  }
  input.value = token;
};

const findTurnstileWidget = (form: HTMLFormElement): HTMLElement | null => {
  const box =
    form.querySelector<HTMLElement>(`#${TURNSTILE_WIDGET_ID}`) ||
    form.querySelector<HTMLElement>('.cf-turnstile');
  if (box) {
    if (!box.id) box.id = TURNSTILE_WIDGET_ID;
    return box;
  }
  const parent = form.querySelector(TURNSTILE_RESPONSE)?.parentElement;
  if (parent && !parent.id) parent.id = TURNSTILE_WIDGET_ID;
  return parent ?? null;
};

const csrfLive = (): string | null => {
  const fromForm =
    freeForm()?.querySelector<HTMLInputElement>('[name="_token"]')?.value ||
    goForm()?.querySelector<HTMLInputElement>('[name="_token"]')?.value;
  return fromForm || csrfFromHtml(document.documentElement.innerHTML);
};

const snapCaptchaForm = (): void => {
  const form = freeForm();
  if (!form?.querySelector(`#${TURNSTILE_WIDGET_ID}, .cf-turnstile`)) return;
  try {
    const clone = form.cloneNode(true) as HTMLElement;
    clone.querySelector(`#${TURNSTILE_WIDGET_ID}, .cf-turnstile`)?.replaceChildren();
    sessionStorage.setItem('sw-cuty-form-snap', clone.outerHTML);
  } catch {}
};

const releasePin = (phase: PinPhase): void => {
  phase.stopPin?.();
  phase.stopPin = null;
};

async function waitPageTurnstile(overlay: FullPageOverlay): Promise<string | null> {
  overlay.setNote(CAPTCHA_NOTE);
  overlay.setStatus('Complete the captcha below.');
  requestAdblockBypass();

  return new Promise((resolve) => {
    const phase: PinPhase = { stopPin: null };
    let done = false;
    let finishing = false;
    let pinAt = 0;

    const finish = (token: string | null): void => {
      if (done) return;
      done = true;
      window.clearInterval(burst);
      obs.disconnect();
      releasePin(phase);
      resolve(token);
    };

    const pin = (): void => {
      if (done) return;
      snapCaptchaForm();
      const live = freeForm();
      if (!live) {
        if (document.querySelector('button.ab')) requestAdblockBypass();
        return;
      }
      const widget = findTurnstileWidget(live);
      if (!widget) return;
      const widgetId = widget.id || TURNSTILE_WIDGET_ID;
      if (!widget.id) widget.id = widgetId;
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
    };

    const check = (): void => {
      if (done || finishing) return;
      pin();
      const form = freeForm();
      if (hasTurnstileFrame(form ?? document) || hasTurnstileFrame(document)) {
        overlay.setStatus('Complete the captcha below.');
      }
      const token = (form ? turnstileToken(form) : null) || turnstileToken(document);
      if (!token || !pinAt || Date.now() - pinAt < 400) return;
      finishing = true;
      overlay.setStatus('Captcha verified…');
      window.setTimeout(() => finish(token), 300);
    };

    pin();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    const burst = window.setInterval(check, 250);
    window.setTimeout(() => {
      if (done) return;
      const form = freeForm();
      finish((form ? turnstileToken(form) : null) || turnstileToken(document));
    }, 180_000);
  });
}

async function finishFromLast(overlay: FullPageOverlay): Promise<void> {
  overlay.setNote(NOTE);
  overlay.setStatus('Getting things ready…');

  const payload = await waitLastPayload();
  if (!payload) {
    overlay.setError('Unlock payload missing. Reload and try again.');
    return;
  }

  requestVisibilitySpoof();

  let sec = payload.sec;
  if (sec <= 0) {
    sec =
      (await waitFor(() => {
        const next = liveCountdownSec();
        return next > 0 ? next : null;
      }, 15_000)) ?? 0;
  }

  if (sec > 0) {
    overlay.setStatus('Unlock timer');
    const endAt = Date.now() + sec * 1000;
    overlay.startCountdown(endAt);
    await sleep(Math.max(0, endAt - Date.now()));
    overlay.hideCountdown();
  } else if ((window as unknown as { countdownValue?: number }).countdownValue !== 0) {
    overlay.setError('Countdown not ready. Reload and try again.');
    return;
  }

  overlay.setStatus('Opening destination…');
  payload.form.submit();
}

async function runCaptchaThenGo(overlay: FullPageOverlay): Promise<void> {
  snapCaptchaForm();
  requestAdblockBypass();
  overlay.setNote(CAPTCHA_NOTE);
  overlay.setStatus('Complete the captcha below.');

  const ready = await waitFor(() => {
    snapCaptchaForm();
    return freeForm()?.querySelector(`#${TURNSTILE_WIDGET_ID}, .cf-turnstile, ${TURNSTILE_RESPONSE}`);
  }, 60_000, 250);
  if (!ready) {
    overlay.setError('Captcha was blocked. Reload with adblock paused for this site, then try again.');
    return;
  }

  const token = await waitPageTurnstile(overlay);
  if (!token) {
    overlay.setError('Turnstile was not completed. Finish the check above.');
    return;
  }

  const form = freeForm();
  if (!form) {
    overlay.setError('Captcha form missing. Reload and try again.');
    return;
  }

  putTokenOnForm(form, token);
  overlay.setNote(NOTE);
  overlay.setStatus('Submitting captcha…');
  form.submit();
}

async function runUnlock(): Promise<void> {
  const overlay = mountUi(NOTE, 'Getting things ready…');
  requestVisibilitySpoof();
  requestAdblockBypass();
  snapCaptchaForm();

  if (!cutyAliasFromPath()) {
    overlay.setError('cuty link alias not found.');
    return;
  }

  const gate = await waitFor(
    () =>
      gateRef() ||
      goForm() ||
      freeForm() ||
      document.querySelector('button.ab') ||
      (isLastStep() ? true : null),
    30_000,
  );
  if (!gate) {
    overlay.setError('cuty gate not found on this page.');
    return;
  }

  const ref = gateRef();

  if (ref === 'show' || isLastStep()) {
    await finishFromLast(overlay);
    return;
  }

  if (ref === 'captcha' || document.querySelector('button.ab')) {
    await runCaptchaThenGo(overlay);
    return;
  }

  const free = freeForm();
  if (free && isCaptchaStep(free)) {
    await runCaptchaThenGo(overlay);
    return;
  }

  if (free && (ref === 'first' || !ref)) {
    const csrf = csrfLive();
    if (!csrf) {
      overlay.setError('CSRF token missing. Reload and try again.');
      return;
    }
    overlay.setStatus('Skipping continue gate…');
    free.submit();
    return;
  }

  overlay.setError('cuty gate not found on this page.');
}

export function initCutyGate(): void {
  if (!isAllowedHost(CUTY_HOSTS)) return;
  if (!isCutyGatePath()) return;

  bootOverlayLock();
  mountUi(NOTE, 'Getting things ready…');
  requestAdblockBypass();
  snapCaptchaForm();

  const tryStart = (): void => {
    if (started) return;
    if (!document.body && document.readyState === 'loading') return;
    started = true;
    void runUnlock();
  };

  tryStart();
  if (started) return;

  const mo = new MutationObserver(() => {
    tryStart();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { tryStart(); mo.disconnect(); }, { once: true });
}
