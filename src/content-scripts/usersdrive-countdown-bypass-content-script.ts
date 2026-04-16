import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';
import { SKIPWAIT_CARD_STYLES } from '../utils/skipwait-card-styles';

const DIRECT_LINK_RE = /href\s*=\s*["']\s*(https?:\/\/[^"'\s]+\/[^"'\s]*\.[A-Za-z0-9]+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s*To\s*Download/i;
const FILE_PATH_RE = /^\/[a-z0-9]{8,24}(?:\.html)?$/i;
const FORM_SIGNATURE = 'form input[name="op"][value="download2"]';
const TURNSTILE_WIDGET_SELECTOR = '.cf-turnstile';
const BACKDROP_Z = '2147483640';
const CARD_Z = '2147483645';
const WIDGET_Z = '2147483646';

interface Overlay {
  error: (text: string) => void;
  info: (text: string) => void;
  success: (text: string) => void;
}

function liftTurnstileWidget(): void {
  const apply = (widget: HTMLElement): void => {
    widget.style.setProperty('position', 'relative', 'important');
    widget.style.setProperty('z-index', WIDGET_Z, 'important');
    widget.style.setProperty('isolation', 'isolate', 'important');
    widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const existing = document.querySelector<HTMLElement>(TURNSTILE_WIDGET_SELECTOR);
  if (existing) apply(existing);
  const mo = new MutationObserver(() => {
    const w = document.querySelector<HTMLElement>(TURNSTILE_WIDGET_SELECTOR);
    if (w && w.style.zIndex !== WIDGET_Z) apply(w);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

function createOverlay(): Overlay {
  const s = SKIPWAIT_CARD_STYLES;
  const backdrop = document.createElement('div');
  backdrop.setAttribute('style', `position:fixed;inset:0;z-index:${BACKDROP_Z};background:rgba(10,12,18,.55);backdrop-filter:blur(2px) saturate(.85);-webkit-backdrop-filter:blur(2px) saturate(.85);`);
  const card = document.createElement('div');
  card.setAttribute('style', `${s.card};position:fixed;top:max(env(safe-area-inset-top,0px),16px);left:50%;transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));z-index:${CARD_Z};margin:0;`);
  const status = document.createElement('p');
  status.setAttribute('style', s.status);
  status.textContent = 'Waiting for Cloudflare verification…';
  card.innerHTML = `<div style="${s.badge}">Skip Wait</div><h2 style="${s.title}">Preparing your download</h2><p style="${s.description}">Cloudflare is verifying in the background. If a checkbox appears below, please tap it — everything else on the page is locked. Your file then starts automatically: no countdown, no second page.</p>`;
  card.appendChild(status);
  const host = document.body ?? document.documentElement;
  host.appendChild(backdrop);
  host.appendChild(card);
  liftTurnstileWidget();
  const set = (text: string, css: string): void => {
    status.textContent = text;
    status.setAttribute('style', css);
  };
  return {
    error: (t) => set(t, s.statusError),
    info: (t) => set(t, s.status),
    success: (t) => set(t, s.statusSuccess),
  };
}

async function fetchDirectLink(form: HTMLFormElement): Promise<string | null> {
  const res = await fetch(form.action || window.location.href, { body: new FormData(form), method: 'POST' });
  return res.ok ? (await res.text()).match(DIRECT_LINK_RE)?.[1]?.trim() ?? null : null;
}

function findForm(): HTMLFormElement | null {
  const input = document.querySelector(FORM_SIGNATURE);
  return input instanceof HTMLInputElement ? input.form : null;
}

function startDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function waitForCloudflareVerification(form: HTMLFormElement): Promise<void> {
  return new Promise((resolve) => {
    if (isCloudflareHumanVerificationDone(form, { requireTurnstileToken: true })) return resolve();
    const mo = new MutationObserver(() => {
      if (!isCloudflareHumanVerificationDone(form, { requireTurnstileToken: true })) return;
      mo.disconnect();
      resolve();
    });
    mo.observe(form, { attributeFilter: ['value'], attributes: true, childList: true, subtree: true });
  });
}

function waitForForm(): Promise<HTMLFormElement | null> {
  return new Promise((resolve) => {
    const existing = findForm();
    if (existing) return resolve(existing);
    const finish = (form: HTMLFormElement | null): void => {
      mo.disconnect();
      document.removeEventListener('readystatechange', onState);
      resolve(form);
    };
    const onState = (): void => {
      if (document.readyState === 'complete') finish(findForm());
    };
    const mo = new MutationObserver(() => {
      const f = findForm();
      if (f) finish(f);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('readystatechange', onState);
  });
}

async function run(): Promise<void> {
  const form = await waitForForm();
  if (!form) return;
  const overlay = createOverlay();
  await waitForCloudflareVerification(form);
  overlay.info('Verification complete. Generating direct link…');
  const link = await fetchDirectLink(form);
  if (!link) return overlay.error('Could not generate a direct link for this file.');
  overlay.success('Your download has started. You can close this tab.');
  startDownload(link);
}

export function initUsersdriveAutomation(): void {
  if (!FILE_PATH_RE.test(window.location.pathname)) return;
  void run();
}
