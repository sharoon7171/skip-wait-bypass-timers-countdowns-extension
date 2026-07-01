import { isAllowedHost } from '../utils/domain-check';
import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';

const HOSTS = ['usersdrive.com'] as const;
const FORM_SELECTOR = 'form .cf-turnstile';
const DIRECT_LINK_RE = /href\s*=\s*["']\s*(https?:\/\/[^"'\s]+\/[^"'\s]*\.[A-Za-z0-9]+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s*To\s*Download/i;
const Z = { widget: '2147483646' };

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
  const lift = liftTurnstileWidget();
  await waitForCloudflareVerification(form);
  lift.disconnect();
  const link = await fetchDirectLink(form);
  if (link) startDownload(link);
}

export function initUsersdriveAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  void run();
}
