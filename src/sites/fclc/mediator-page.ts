import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { requestFclcLinksGo } from './links-go';
import { FCLC_MEDIATOR_HOSTS } from './mediator-hosts';

const OVERLAY_ID = 'skip-wait-fclc-mediator-overlay';
const STEP1_FORM = 'form.text-center';
const STEP1_FDATA = 'input[name="fdata"]';
const STEP2_FORM = '#form12';
const CF_SECTION = '#cf-section';
const TURNSTILE_WIDGET_ID = 'skip-wait-fclc-mediator-turnstile';
const TURNSTILE_PIN_STYLE_ID = 'skip-wait-fclc-mediator-turnstile-pin';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const TURNSTILE_IFRAMES = [
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="turnstile"]',
] as const;
const LINKS_GO_DEFAULT = 'https://fc.lc/links/go';
const STEP1_SERVER_MS = 15_000;
const STEP2_TIMER_MS = 15_000;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;
const TURNSTILE_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Complete the Turnstile check below. We’ll continue automatically when it’s done.',
} as const;

type Step2Fields = Record<string, string>;

let ui: FullPageOverlay | null = null;
let step2Fields: Step2Fields | null = null;
let step2Action: string | null = null;
let started = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const mountUi = (note: typeof NOTE | typeof TURNSTILE_NOTE = NOTE, status = 'Getting things ready…'): FullPageOverlay => {
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

const step1Form = (): HTMLFormElement | null => {
  const form = document.querySelector<HTMLFormElement>(STEP1_FORM);
  if (!form?.querySelector(STEP1_FDATA)) return null;
  return form;
};

const isStep1Mediator = (): boolean => !!step1Form();

const readDomainUrl = (): string => {
  for (const s of document.scripts) {
    const m = (s.textContent ?? '').match(/domainUrl\s*=\s*["'](https?:\/\/[^"']+)["']/);
    if (m?.[1]) return m[1];
  }
  return LINKS_GO_DEFAULT;
};

const captureStep2FromDom = (): void => {
  const form = document.querySelector<HTMLFormElement>(STEP2_FORM);
  if (!form) return;
  const fields: Step2Fields = {};
  for (const el of form.elements) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) continue;
    if (!el.name) continue;
    fields[el.name] = el.value ?? '';
  }
  if (!fields['ad_form_data'] || !fields['visitor']) return;
  step2Fields = fields;
  step2Action = readDomainUrl();
};

const isStep2Mediator = (): boolean => {
  if (step2Fields) return true;
  if (document.querySelector(STEP2_FORM)) return true;
  for (const s of document.scripts) {
    if ((s.textContent ?? '').includes('domainUrl') && (s.textContent ?? '').includes('startTimeout')) return true;
  }
  return false;
};

const hasTurnstileToken = (): string | null => {
  for (const el of document.querySelectorAll(TURNSTILE_RESPONSE)) {
    const v = (el as HTMLInputElement | HTMLTextAreaElement).value?.trim();
    if (v && v.length > 20) return v;
  }
  return null;
};

const findTurnstileWidget = (): HTMLElement | null => {
  const section = document.querySelector<HTMLElement>(CF_SECTION);
  if (section) {
    section.style.setProperty('display', 'block', 'important');
    const inner = section.querySelector<HTMLElement>('.cf-turnstile');
    if (inner) return inner;
    return section;
  }
  return document.querySelector<HTMLElement>('.cf-turnstile');
};

const ensureWidgetId = (el: HTMLElement): string => {
  if (!el.id) el.id = TURNSTILE_WIDGET_ID;
  return el.id;
};

const waitServerTimer = async (overlay: FullPageOverlay, ms: number, status: string): Promise<void> => {
  overlay.setNote(NOTE);
  overlay.setStatus(status);
  overlay.startCountdown(Date.now() + ms);
  await sleep(ms);
  overlay.hideCountdown();
};

const unlockOnce = async (overlay: FullPageOverlay, token: string): Promise<string | null> => {
  const fields = step2Fields;
  const action = step2Action || readDomainUrl();
  if (!fields) {
    overlay.setStatus('Unlock form missing — reload from the short link.');
    return null;
  }

  overlay.setNote(NOTE);
  overlay.setStatus('Unlocking…');
  const { url, message } = await requestFclcLinksGo(action, { ...fields, token }, location.href);
  if (url) return url;
  overlay.setStatus(message || 'Unlock failed — reload from the short link.');
  return null;
};

const runStep1 = async (overlay: FullPageOverlay): Promise<void> => {
  const form = step1Form();
  if (!form) {
    overlay.setStatus('Mediator form missing — open the short link again.');
    return;
  }

  requestVisibilitySpoof();
  overlay.setStatus('Preparing step 1 of 2…');

  const res = await fetch('?start_countdown=1', { credentials: 'include' });
  const data = (await res.json()) as { rand?: string };
  if (!data.rand) {
    overlay.setStatus('Countdown token missing — reload from the short link.');
    return;
  }

  const fdata = form.querySelector<HTMLInputElement>(STEP1_FDATA);
  if (!fdata) {
    overlay.setStatus('fdata field missing — reload from the short link.');
    return;
  }
  fdata.value = data.rand;

  await waitServerTimer(overlay, STEP1_SERVER_MS, 'Step 1 of 2 — waiting…');
  overlay.setStatus('Continuing to step 2…');
  form.submit();
};

const waitForTurnstile = (overlay: FullPageOverlay): Promise<string> =>
  new Promise((resolve) => {
    overlay.setNote(TURNSTILE_NOTE);
    overlay.setStatus('Waiting for Turnstile…');

    let stopPin: (() => void) | null = null;
    let done = false;

    const ensurePin = (): void => {
      if (done || stopPin) return;
      const widget = findTurnstileWidget();
      if (!widget) return;
      const widgetId = ensureWidgetId(widget);
      stopPin = pinSiteWidgetOverOverlay({
        overlayId: OVERLAY_ID,
        mount: overlay.turnstileMount,
        widgetId,
        styleId: TURNSTILE_PIN_STYLE_ID,
        alsoVisibleSelectors: TURNSTILE_IFRAMES,
      });
    };

    const tick = (): void => {
      if (done) return;
      ensurePin();
      const token = hasTurnstileToken();
      if (token) {
        done = true;
        stopPin?.();
        stopPin = null;
        resolve(token);
        return;
      }
      requestAnimationFrame(tick);
    };

    ensurePin();
    requestAnimationFrame(tick);
  });

const runStep2 = (overlay: FullPageOverlay): void => {
  captureStep2FromDom();
  if (!step2Fields) {
    overlay.setStatus('Unlock form missing — open the short link again.');
    return;
  }

  requestVisibilitySpoof();
  step2Action = step2Action || readDomainUrl();

  void (async () => {
    await waitServerTimer(overlay, STEP2_TIMER_MS, 'Step 2 of 2 — waiting…');
    const token = await waitForTurnstile(overlay);
    const url = await unlockOnce(mountUi(NOTE, 'Unlocking…'), token);
    if (url) {
      mountUi().setStatus('Redirecting now…');
      location.replace(url);
    }
  })().catch(() => {
    overlay.setStatus('Something went wrong — open the short link again.');
  });
};

const start = (): void => {
  if (started || !isAllowedHost(FCLC_MEDIATOR_HOSTS)) return;
  captureStep2FromDom();
  if (!isStep1Mediator() && !isStep2Mediator()) return;
  started = true;

  const overlay = mountUi();
  if (isStep1Mediator()) {
    void runStep1(overlay).catch(() => {
      overlay.setStatus('Something went wrong — open the short link again.');
    });
    return;
  }
  runStep2(overlay);
};

export function initFclcMediatorPage(): void {
  if (!isAllowedHost(FCLC_MEDIATOR_HOSTS)) return;

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      captureStep2FromDom();
    },
    true,
  );

  whenDomParsed(() => {
    start();
    if (isStep1Mediator() || isStep2Mediator() || step2Fields) return;
    const mo = new MutationObserver(() => {
      captureStep2FromDom();
      if (!isStep1Mediator() && !isStep2Mediator() && !step2Fields) return;
      mo.disconnect();
      start();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
}
