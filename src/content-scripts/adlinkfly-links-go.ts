import { hasCaptchaToken } from '../utils/captcha-verifier';

const LINKS_GO_SHELL_SEL = '#link-view,#go-link,form[action*="/links/go"],a.get-link';

const RECAPTCHA_NAMES = ['g-recaptcha-response'];

const isRealUrl = (s: string): boolean =>
  s.startsWith('http://') || s.startsWith('https://');

function isAdlinkflyLinksGoShell(doc: Document = document): boolean {
  return !!doc.querySelector(LINKS_GO_SHELL_SEL);
}

function hasLinksGoHint(): boolean {
  if (isAdlinkflyLinksGoShell()) return true;
  for (const s of document.scripts) {
    if (s.textContent?.includes('/links/go')) return true;
  }
  return false;
}

function runWhenNotLoading(run: () => void): void {
  if (document.readyState !== 'loading') run();
  else
    document.addEventListener('readystatechange', function onReady() {
      if (document.readyState === 'loading') return;
      document.removeEventListener('readystatechange', onReady);
      run();
    });
}

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

function startAdlinkflyLinksGo(): void {
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
  const rafLoop = (): void => {
    if (run()) return void observer.disconnect();
    if (++frames < 960) requestAnimationFrame(rafLoop);
  };
  requestAnimationFrame(rafLoop);
}

function initAdlinkflyLinksGo(): void {
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
  function stop(): void {
    mo?.disconnect();
    mo = null;
    document.removeEventListener('readystatechange', onReadyState);
  }
  mo = new MutationObserver(() => {
    tryStart();
    if (engaged) stop();
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('readystatechange', onReadyState);
  onReadyState();
}

initAdlinkflyLinksGo();
