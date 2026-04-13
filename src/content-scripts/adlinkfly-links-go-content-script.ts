import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { hasCaptchaToken } from '../utils/captcha-verifier';

const ADLINKFLY_HOSTS = ['adfly.site', 'demo-adlinkfly.themeson.com', 'pahe.plus', 'wu8.in'] as const;

const RECAPTCHA_NAMES = ['g-recaptcha-response'];

const isRealUrl = (s: string): boolean =>
  s.startsWith('http://') || s.startsWith('https://');

function onCaptchaPage(form: HTMLFormElement): void {
  if (!form.querySelector('[name="g-recaptcha-response"]')) return;
  const tick = (): void => {
    if (hasCaptchaToken(form, RECAPTCHA_NAMES)) form.submit();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function onTimerPage(posted: { done: boolean }): boolean {
  const link = document.querySelector<HTMLAnchorElement>('a.get-link');
  if (link?.href && isRealUrl(link.href)) {
    window.location.href = link.href;
    return true;
  }
  const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
  if (!form || posted.done) return false;
  posted.done = true;
  const action = form.action && isRealUrl(form.action)
    ? form.action
    : new URL(form.getAttribute('action') || '/links/go', window.location.origin).href;
  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, typeof v === 'string' ? v : ''));
  fetch(action, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
    .then((r) => r.json())
    .then((data: { url?: string }) => {
      const url = typeof data?.url === 'string' ? data.url.trim() : '';
      if (isRealUrl(url)) window.location.href = url;
    })
    .catch(() => {});
  return false;
}

export function attachAdlinkflyLinksGo(): void {
  whenDomParsed(() => {
    const posted = { done: false };
    const run = (): boolean => {
      const linkView = document.getElementById('link-view') as HTMLFormElement | null;
      if (linkView) {
        onCaptchaPage(linkView);
        return false;
      }
      return onTimerPage(posted);
    };

    const observer = new MutationObserver(() => {
      if (run()) observer.disconnect();
    });

    chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
    if (run()) return;
    observer.observe(document.documentElement, {
      attributeFilter: ['href'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    let micro = 0;
    const microBurst = (): void => {
      if (run()) return void observer.disconnect();
      if (++micro < 48) queueMicrotask(microBurst);
    };
    queueMicrotask(microBurst);
    let frames = 0;
    const raf = (): void => {
      if (run()) return void observer.disconnect();
      if (++frames < 960) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  });
}

export function initAdlinkflyLinksGo(): void {
  if (!isAllowedHost(ADLINKFLY_HOSTS)) return;
  attachAdlinkflyLinksGo();
}
