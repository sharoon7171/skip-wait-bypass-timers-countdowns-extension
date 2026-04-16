const TS = '[name="cf-turnstile-response"]';
const PATH = /^\/(?:r|download)\/[^/]+/;

function isInterstitialPath(): boolean {
  return PATH.test(location.pathname);
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
      attributeFilter: ['disabled', 'class'],
    });
    const loop = () => {
      if (run()) return;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}

function yieldMain(): Promise<void> {
  return new Promise((r) =>
    queueMicrotask(() => queueMicrotask(() => requestAnimationFrame(() => requestAnimationFrame(() => r())))),
  );
}

async function step1(): Promise<void> {
  const gen = document.getElementById('generateBtn');
  if (gen instanceof HTMLButtonElement && !gen.disabled && !gen.classList.contains('hidden')) {
    gen.click();
    await yieldMain();
  }
  await until(() => {
    const c = document.getElementById('continueBtn');
    return c instanceof HTMLButtonElement && !c.disabled && !c.classList.contains('hidden');
  });
  document.getElementById('continueBtn')?.click();
}

async function step2(): Promise<void> {
  await until(() => {
    const b = document.getElementById('goToLinkBtn');
    const t = document.querySelector<HTMLInputElement>(TS)?.value?.trim() ?? '';
    return b instanceof HTMLButtonElement && !b.disabled && t.length > 0;
  });
  await yieldMain();
  document.getElementById('goToLinkBtn')?.click();
}

function boot(): void {
  if (!isInterstitialPath()) return;
  const q = new URLSearchParams(location.search);
  if (q.get('step') === '2' && q.get('sid')) void step2();
  else void step1();
}

export function initXdmoviesLatestnewsAutomation(): void {
  if (window !== window.top) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
