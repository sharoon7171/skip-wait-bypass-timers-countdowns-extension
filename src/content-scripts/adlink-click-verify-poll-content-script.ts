const VERIFY_PATH = '/verify.php';
const POLL_MS = 10;

const SHELL_IDS = ['#skip-btn', '#timer', '#captchaForm'] as const;

function whenNotLoading(run: () => void): void {
  if (document.readyState !== 'loading') {
    run();
    return;
  }
  document.addEventListener('readystatechange', function onReady() {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', onReady);
    run();
  });
}

function isVerifyShell(): boolean {
  if (!SHELL_IDS.every((sel) => document.querySelector(sel))) return false;
  return [...document.querySelectorAll('script:not([src])')].some((el) => {
    const t = el.textContent ?? '';
    return t.includes('verify.php') && t.includes('check.php');
  });
}

let started = false;

function pollVerify(): void {
  const href = new URL(VERIFY_PATH, location.origin).href;
  let intervalId = 0;
  let done = false;

  const redirect = (url: string): void => {
    if (done) return;
    done = true;
    clearInterval(intervalId);
    location.replace(url);
  };

  const tick = (): void => {
    if (done) return;
    void (async () => {
      try {
        const text = await (await fetch(href, { credentials: 'same-origin' })).text();
        if (done) return;
        const data = JSON.parse(text) as { status?: unknown; url?: unknown };
        const url = typeof data.url === 'string' ? data.url.trim() : '';
        if (
          data.status === 'ok' &&
          url &&
          (url.startsWith('https://') || url.startsWith('http://'))
        ) {
          redirect(url);
        }
      } catch {}
    })();
  };

  tick();
  intervalId = window.setInterval(tick, POLL_MS);
}

function initAdlinkClickVerifyPoll(): void {
  const tryStart = (): void => {
    if (started || !isVerifyShell()) return;
    started = true;
    pollVerify();
  };

  tryStart();
  if (started) return;

  const root = document.documentElement;
  if (!root) {
    whenNotLoading(tryStart);
    return;
  }

  let mo: MutationObserver | null = null;

  const onReadyState = (): void => {
    if (document.readyState === 'loading') return;
    tryStart();
    if (started) {
      teardown();
      return;
    }
    if (document.readyState === 'complete' && mo && !isVerifyShell()) teardown();
  };

  function teardown(): void {
    mo?.disconnect();
    mo = null;
    document.removeEventListener('readystatechange', onReadyState);
  }

  mo = new MutationObserver(() => {
    tryStart();
    if (started) teardown();
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('readystatechange', onReadyState);
  onReadyState();
}

initAdlinkClickVerifyPoll();
