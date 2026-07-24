import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { OUO_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-ouo-overlay';
const BOOT_STYLE_ID = 'skip-wait-ouo-boot';
const FORM = '#form-captcha';
const TURNSTILE = '[name="cf-turnstile-response"]';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let done = false;
let started = false;

const bootOverlayLock = (): void => {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
};

const mountUi = (status: string): FullPageOverlay => {
  bootOverlayLock();
  if (ui) {
    ui.setStatus(status);
    ui.setError(null);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
    countdownLabel: 'Your link opens in',
  });
  return ui;
};

function captchaForm(): HTMLFormElement | null {
  const form = document.querySelector<HTMLFormElement>(FORM);
  if (!form) return null;
  const action = form.getAttribute('action') || form.action || '';
  if (!/\/(?:go|x)\//i.test(action)) return null;
  return form;
}

function turnstileReady(form: HTMLFormElement): boolean {
  const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(TURNSTILE);
  if (!el) return true;
  const v = el.value?.trim() ?? '';
  return v.length > 20;
}

function submitWhenReady(form: HTMLFormElement): void {
  if (done) return;
  const overlay = mountUi('Waiting for verification…');
  const tick = (): void => {
    if (done) return;
    if (!document.contains(form)) return;
    if (!turnstileReady(form)) {
      window.setTimeout(tick, 150);
      return;
    }
    done = true;
    overlay.setStatus('Continuing…');
    form.submit();
  };
  tick();
}

function run(): void {
  if (started) return;
  const form = captchaForm();
  if (!form) return;
  started = true;
  submitWhenReady(form);
}

export function initOuoBypass(): void {
  if (!isAllowedHost(OUO_HOSTS)) return;

  whenDomParsed(run);

  const mo = new MutationObserver(() => {
    run();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
