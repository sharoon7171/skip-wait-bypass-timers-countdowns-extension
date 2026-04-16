import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';

const PATH = /^\/(?:r|download)\/[^/]+/;
const MSG_VISIBILITY = 'INJECT_VISIBILITY_SPOOF';

function isInterstitialPath(): boolean {
  return PATH.test(location.pathname);
}

function headingEl(): HTMLElement | null {
  return document.getElementById('title') ?? document.querySelector('main h1');
}

function headingIncludes(sub: string): boolean {
  const t = headingEl()?.textContent ?? '';
  return t.includes(sub);
}

function settle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function untilStable(ready: () => boolean, stableMs: number): Promise<void> {
  return new Promise((resolve) => {
    let okSince: number | null = null;
    let raf = 0;
    let mo: MutationObserver | undefined;
    const stop = () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      document.removeEventListener('input', tick, true);
      document.removeEventListener('change', tick, true);
    };
    const tick = (): void => {
      const now = performance.now();
      if (!ready()) {
        okSince = null;
        return;
      }
      if (okSince === null) okSince = now;
      if (now - okSince >= stableMs) {
        stop();
        resolve();
      }
    };
    const loop = (): void => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    mo = new MutationObserver(tick);
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    document.addEventListener('input', tick, true);
    document.addEventListener('change', tick, true);
    tick();
    raf = requestAnimationFrame(loop);
  });
}

function until(ready: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let raf = 0;
    let mo: MutationObserver | undefined;
    const stop = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('input', run, true);
      document.removeEventListener('change', run, true);
      mo?.disconnect();
    };
    const run = (): boolean => {
      if (!ready()) return false;
      stop();
      resolve();
      return true;
    };
    if (run()) return;
    mo = new MutationObserver(run);
    document.addEventListener('input', run, true);
    document.addEventListener('change', run, true);
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const loop = () => {
      if (run()) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}

function clickById(id: string): void {
  document.getElementById(id)?.click();
}

function showsServerTimerError(): boolean {
  return (document.body?.innerText ?? '').includes('Please wait for the timer to complete');
}

function step2GoReady(): boolean {
  const b = document.getElementById('goToLinkBtn');
  return (
    b instanceof HTMLButtonElement &&
    !b.disabled &&
    !b.classList.contains('hidden') &&
    isCloudflareHumanVerificationDone(undefined, { requireTurnstileToken: true })
  );
}

async function step1(): Promise<void> {
  const gen = document.getElementById('generateBtn');
  if (gen instanceof HTMLButtonElement && !gen.disabled && !gen.classList.contains('hidden')) {
    clickById('generateBtn');
  }
  const continueOk = (): boolean => {
    const c = document.getElementById('continueBtn');
    return (
      c instanceof HTMLButtonElement &&
      !c.disabled &&
      !c.classList.contains('hidden') &&
      (headingIncludes('Complete') || headingIncludes('Step 1'))
    );
  };
  await until(continueOk);
  await untilStable(continueOk, 600);
  await settle(400);
  clickById('continueBtn');
}

async function step2(): Promise<void> {
  await until(() => headingIncludes('Ready'));
  for (let attempt = 0; attempt < 3; attempt++) {
    await until(() => step2GoReady());
    await untilStable(step2GoReady, 900);
    await settle(700);
    clickById('goToLinkBtn');
    await settle(500);
    if (!showsServerTimerError()) return;
    await settle(attempt === 0 ? 1400 : 900);
  }
}

function boot(): void {
  if (!isInterstitialPath()) return;
  const q = new URLSearchParams(location.search);
  if (q.get('step') === '2' && q.get('sid')) void step2();
  else void step1();
}

export function initXdmoviesLatestnewsAutomation(): void {
  if (window !== window.top) return;
  if (PATH.test(location.pathname)) {
    try {
      chrome.runtime.sendMessage({ type: MSG_VISIBILITY });
    } catch {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
