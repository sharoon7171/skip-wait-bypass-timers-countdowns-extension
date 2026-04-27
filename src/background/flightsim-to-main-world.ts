import { hostnameMatches } from '../utils/domain-check';
import { bootstrapRemoteDomains, getHostsByKey } from '../utils/remote-domains';

const FLIGHTSIM_KEY = 'flightsim-to-download-instant';
const FLIGHTSIM_SITEKEY = '0x4AAAAAAAEkCIsHFwbAgKn3';
const ADDON_PATH_RE = /^\/addon\/\d+(?:\/|$)/i;

export function runFlightsimDownloadPatch(sitekey: string): void {
  type TurnstileOpts = {
    sitekey: string;
    callback?: (token: string) => void;
    'expired-callback'?: () => void;
    'error-callback'?: () => void;
    size?: string;
    theme?: string;
  };
  type TurnstileApi = {
    render: (el: HTMLElement, opts: TurnstileOpts) => string;
    reset: (id?: string) => void;
    remove: (id?: string) => void;
  };
  type Patched = Window & {
    __swFlightsimPatched?: boolean;
    __swFlightsimRenderPatched?: boolean;
    __swFlightsimTurnstileReady?: () => void;
    turnstile?: TurnstileApi;
  };

  const w = window as Patched;
  if (w.__swFlightsimPatched) return;
  w.__swFlightsimPatched = true;

  const ONLOAD_NAME = '__swFlightsimTurnstileReady';
  const TURNSTILE_API = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${ONLOAD_NAME}`;
  const COUNTDOWN_TEXT = 'Your download will start in';
  const DOWNLOAD_HEADING_RE = /^\s*Download\b/i;
  const COUNTDOWN_DELAY_MIN = 800;
  const COUNTDOWN_DELAY_MAX = 1200;

  const nativeSetTimeout = window.setTimeout.bind(window);

  let cachedToken: string | null = null;
  let widgetMounted = false;
  let widgetId: string | null = null;
  const tokenListeners: Array<(token: string) => void> = [];

  const setCachedToken = (token: string | null): void => {
    cachedToken = token;
    if (!token) return;
    const listeners = tokenListeners.splice(0, tokenListeners.length);
    for (const l of listeners) {
      try {
        l(token);
      } catch {}
    }
  };

  const findDownloadDialog = (): Element | null => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dlg of Array.from(dialogs)) {
      const h = dlg.querySelector('h2');
      if (h && DOWNLOAD_HEADING_RE.test(h.textContent ?? '')) return dlg;
    }
    return null;
  };

  const isDialogInCountdown = (): boolean => {
    const dlg = findDownloadDialog();
    return !!dlg && (dlg.textContent ?? '').includes(COUNTDOWN_TEXT);
  };

  const renderInvisibleWidget = (ts: TurnstileApi): void => {
    if (widgetMounted) return;
    widgetMounted = true;
    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;';
    document.body.appendChild(host);
    widgetId = ts.render(host, {
      sitekey,
      size: 'invisible',
      callback: (t) => setCachedToken(t),
      'expired-callback': () => {
        cachedToken = null;
        if (widgetId) {
          try {
            ts.reset(widgetId);
          } catch {}
        }
      },
      'error-callback': () => {
        widgetMounted = false;
      },
    });
  };

  const startPrewarm = (ts: TurnstileApi): void => {
    if (document.body) {
      renderInvisibleWidget(ts);
      return;
    }
    const obs = new MutationObserver(() => {
      if (!document.body) return;
      obs.disconnect();
      renderInvisibleWidget(ts);
    });
    obs.observe(document.documentElement, { childList: true });
  };

  const patchTurnstileRender = (ts: TurnstileApi): void => {
    if (w.__swFlightsimRenderPatched) return;
    w.__swFlightsimRenderPatched = true;
    const origRender = ts.render.bind(ts);
    ts.render = function patchedRender(el: HTMLElement, opts: TurnstileOpts): string {
      if (opts && opts.sitekey === sitekey && typeof opts.callback === 'function') {
        const origCallback = opts.callback;
        let fired = false;
        const fireOnce = (token: string): void => {
          if (fired) return;
          fired = true;
          try {
            origCallback(token);
          } catch {}
        };
        opts.callback = fireOnce;
        const id = origRender(el, opts);
        if (cachedToken) {
          queueMicrotask(() => fireOnce(cachedToken!));
        } else {
          tokenListeners.push(fireOnce);
        }
        return id;
      }
      return origRender(el, opts);
    };
  };

  const onTurnstileReady = (): void => {
    const ts = w.turnstile;
    if (!ts) return;
    patchTurnstileRender(ts);
    startPrewarm(ts);
  };

  let fakeTimerId = 1_000_000_000;
  window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => {
    const skip =
      typeof delay === 'number' &&
      delay >= COUNTDOWN_DELAY_MIN &&
      delay <= COUNTDOWN_DELAY_MAX &&
      isDialogInCountdown();
    if (skip) {
      const fn = typeof handler === 'function' ? handler : new Function(handler as string);
      queueMicrotask(() => {
        try {
          (fn as (...args: unknown[]) => void)(...rest);
        } catch {}
      });
      return ++fakeTimerId as unknown as ReturnType<typeof setTimeout>;
    }
    return nativeSetTimeout(handler, delay, ...rest);
  }) as typeof setTimeout;

  w.__swFlightsimTurnstileReady = onTurnstileReady;

  if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    const s = document.createElement('script');
    s.src = TURNSTILE_API;
    s.async = true;
    (document.head ?? document.documentElement).appendChild(s);
  }

  if (w.turnstile) onTurnstileReady();
}

let domainsLoaded = false;
async function ensureRemoteDomains(): Promise<readonly string[]> {
  if (!domainsLoaded) {
    await bootstrapRemoteDomains();
    if (getHostsByKey(FLIGHTSIM_KEY).length > 0) domainsLoaded = true;
  }
  return getHostsByKey(FLIGHTSIM_KEY);
}

async function isFlightsimAddonUrl(url: string | undefined): Promise<boolean> {
  if (!url || !URL.canParse(url)) return false;
  const u = new URL(url);
  if (!ADDON_PATH_RE.test(u.pathname)) return false;
  const hosts = await ensureRemoteDomains();
  return hostnameMatches(u.hostname, hosts);
}

export function initFlightsimToMainWorldInject(): void {
  void ensureRemoteDomains();
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading') return;
    const url = changeInfo.url ?? tab.url;
    void (async () => {
      if (!(await isFlightsimAddonUrl(url))) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          world: 'MAIN',
          injectImmediately: true,
          func: runFlightsimDownloadPatch,
          args: [FLIGHTSIM_SITEKEY],
        });
      } catch {}
    })();
  });
}
