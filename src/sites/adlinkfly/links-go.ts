import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../../content-scripts/arolinks/page';
import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { hasCaptchaToken } from '../../utils/captcha-verifier';

const OVERLAY_ID = 'skip-wait-adlinkfly-overlay';
const LINKS_GO_SHELL_SEL = '#link-view,#go-link,form[action*="/links/go"],a.get-link';
const RECAPTCHA_NAMES = ['g-recaptcha-response'];
const NOTE =
  '<strong>Hang tight — unlocking your link.</strong> You don\'t need to tap anything on the page.';

const isRealUrl = (s: string): boolean => s.startsWith('http://') || s.startsWith('https://');

let ui: FullPageOverlay | null = null;

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
    noteHtml: NOTE,
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

const hasLinksGoHint = (): boolean => {
  if (isAdlinkflyLinksGoShell()) return true;
  for (const s of document.scripts) {
    if (s.textContent?.includes('/links/go')) return true;
  }
  return false;
};

const arolinksBypassActive = (): boolean => {
  if (!location.hostname.includes('arolinks.com')) return false;
  if (!document.getElementById('skip-wait-arolinks-overlay')) return false;
  return !isAdlinkflyLinksGoShell();
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

const onCaptchaPage = (form: HTMLFormElement, overlay: FullPageOverlay): void => {
  if (!form.querySelector('[name="g-recaptcha-response"]')) return;
  overlay.setStatus('Completing verification…');
  const tick = (): void => {
    if (hasCaptchaToken(form, RECAPTCHA_NAMES)) form.submit();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const onTimerPage = async (posted: { done: boolean }, overlay: FullPageOverlay): Promise<boolean> => {
  const link = document.querySelector<HTMLAnchorElement>('a.get-link');
  if (link?.href && isRealUrl(link.href)) {
    redirectTo(link.href);
    return true;
  }
  const form = document.querySelector<HTMLFormElement>('#go-link, form[action*="/links/go"]');
  if (!form || posted.done) return false;
  posted.done = true;
  const url = await finishTimerUnlock(overlay);
  if (!url) return false;
  redirectTo(url);
  return true;
};

const startAdlinkflyLinksGo = (): void => {
  const overlay = mountUi();
  const posted = { done: false };
  let finished = false;

  const run = (): void => {
    if (finished) return;
    const linkView = document.getElementById('link-view') as HTMLFormElement | null;
    if (linkView) {
      onCaptchaPage(linkView, overlay);
      return;
    }
    void onTimerPage(posted, overlay).then((ok) => {
      if (ok) finished = true;
    });
  };

  const observer = new MutationObserver(run);
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
  run();
  observer.observe(document.documentElement, {
    attributeFilter: ['href'],
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
  let engaged = false;
  const tryStart = (): void => {
    if (engaged || arolinksBypassActive() || !isAdlinkflyLinksGoShell()) return;
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
