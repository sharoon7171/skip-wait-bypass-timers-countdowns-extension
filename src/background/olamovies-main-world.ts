const OLAMOVIES_HOST = 'links.olamovies.mov';
const CAPTCHA_CONFIG_PATH = '/api/captcha/config';
const READY_ATTR = 'data-sw-ola-cfg-ready';

export function patchOlamoviesTimers(): void {
  const w = window as Window & { __swOlaPatched?: boolean };
  if (w.__swOlaPatched) return;
  w.__swOlaPatched = true;

  const nativeSetTimeout = window.setTimeout.bind(window);
  const isFakeWait = (delay: unknown): boolean =>
    typeof delay === 'number' && delay >= 8000 && delay <= 20000;

  window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
    const d = isFakeWait(delay) ? 0 : (delay as number | undefined);
    return nativeSetTimeout(handler, d as number | undefined, ...rest);
  }) as typeof setTimeout;

  const markCfgReady = (): void => {
    try {
      document.documentElement?.setAttribute(READY_ATTR, '1');
    } catch {}
  };

  const isCfgUrl = (input: RequestInfo | URL): boolean => {
    try {
      const raw =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      return typeof raw === 'string' && raw.includes(CAPTCHA_CONFIG_PATH);
    } catch {
      return false;
    }
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const p = nativeFetch(input as RequestInfo, init);
    if (isCfgUrl(input)) {
      p.then(() => markCfgReady()).catch(() => {});
    }
    return p;
  }) as typeof fetch;
}

function isOlamoviesUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === OLAMOVIES_HOST;
  } catch {
    return false;
  }
}

export function initOlamoviesMainWorldInject(): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading') return;
    if (!isOlamoviesUrl(changeInfo.url ?? tab.url)) return;
    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: false },
        world: 'MAIN',
        injectImmediately: true,
        func: patchOlamoviesTimers,
      })
      .catch(() => {});
  });
}
