import { isAllowedHost } from '../utils/domain-check';
import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';
import { SKIPWAIT_CARD_STYLES } from '../utils/skipwait-card-styles';

const HOSTS: readonly string[] = ['usersdrive.com'];
const FORM_SELECTOR = 'form .cf-turnstile';
const DIRECT_LINK_RE = /href\s*=\s*["']\s*(https?:\/\/[^"'\s]+\/[^"'\s]*\.[A-Za-z0-9]+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s*To\s*Download/i;
const Z = { backdrop: '2147483640', card: '2147483645', widget: '2147483646' };

function liftTurnstileWidget(): MutationObserver {
  const apply = (w: HTMLElement): void => {
    w.style.setProperty('position', 'relative', 'important');
    w.style.setProperty('z-index', Z.widget, 'important');
    w.style.setProperty('isolation', 'isolate', 'important');
    w.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const initial = document.querySelector<HTMLElement>('.cf-turnstile');
  if (initial) apply(initial);
  const mo = new MutationObserver(() => {
    const w = document.querySelector<HTMLElement>('.cf-turnstile');
    if (w && w.style.zIndex !== Z.widget) apply(w);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  return mo;
}

function createOverlay(): { error: (t: string) => void; info: (t: string) => void; success: (t: string) => void } {
  const s = SKIPWAIT_CARD_STYLES;
  const backdrop = document.createElement('div');
  backdrop.setAttribute('style', `position:fixed;inset:0;z-index:${Z.backdrop};background:rgba(10,12,18,.55);backdrop-filter:blur(2px) saturate(.85);-webkit-backdrop-filter:blur(2px) saturate(.85);`);
  const card = document.createElement('div');
  card.setAttribute('style', `${s.card};position:fixed;top:max(env(safe-area-inset-top,0px),16px);left:50%;transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));z-index:${Z.card};margin:0;`);
  card.innerHTML = `<div style="${s.badge}">Skip Wait</div><h2 style="${s.title}">Preparing your download</h2><p style="${s.description}">Cloudflare is verifying in the background. If a checkbox appears below, please tap it — everything else on the page is locked. Your file then starts automatically: no countdown, no second page.</p>`;
  const status = document.createElement('p');
  status.setAttribute('style', s.status);
  status.textContent = 'Waiting for Cloudflare verification…';
  card.appendChild(status);
  document.body.append(backdrop, card);
  const set = (t: string, css: string): void => {
    status.textContent = t;
    status.setAttribute('style', css);
  };
  return {
    error: (t) => set(t, s.statusError),
    info: (t) => set(t, s.status),
    success: (t) => set(t, s.statusSuccess),
  };
}

function waitForForm(): Promise<HTMLFormElement> {
  return new Promise((resolve) => {
    const get = (): HTMLFormElement | null =>
      document.querySelector(FORM_SELECTOR)?.closest('form') ?? null;
    const initial = get();
    if (initial) return resolve(initial);
    const mo = new MutationObserver(() => {
      const f = get();
      if (!f) return;
      mo.disconnect();
      resolve(f);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function waitForCloudflareVerification(form: HTMLFormElement): Promise<void> {
  return new Promise((resolve) => {
    const done = (): boolean => isCloudflareHumanVerificationDone(form, { requireTurnstileToken: true });
    if (done()) return resolve();
    const mo = new MutationObserver(() => {
      if (!done()) return;
      mo.disconnect();
      resolve();
    });
    mo.observe(form, { attributeFilter: ['value'], attributes: true, childList: true, subtree: true });
  });
}

async function fetchDirectLink(form: HTMLFormElement): Promise<string | null> {
  const res = await fetch(form.action || window.location.href, { body: new FormData(form), method: 'POST' });
  return res.ok ? (await res.text()).match(DIRECT_LINK_RE)?.[1]?.trim() ?? null : null;
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

async function run(): Promise<void> {
  const form = await waitForForm();
  const overlay = createOverlay();
  const lift = liftTurnstileWidget();
  await waitForCloudflareVerification(form);
  lift.disconnect();
  overlay.info('Verification complete. Generating direct link…');
  const link = await fetchDirectLink(form);
  if (!link) return overlay.error('Could not generate a direct link for this file.');
  overlay.success('Your download has started. You can close this tab.');
  startDownload(link);
}

export function initUsersdriveAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  void run();
}
