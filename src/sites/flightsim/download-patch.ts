import { hostnameMatches } from '../../utils/domain-check';

const HOSTS = ['flightsim.to'] as const;
const ADDON_PATH_RE = /^\/addon\/\d+(?:\/|$)/i;

export function runFlightsimDownloadPatch(): void {
  type Patched = Window & { __swFlightsimPatched?: boolean };
  const w = window as Patched;
  if (w.__swFlightsimPatched) return;
  w.__swFlightsimPatched = true;

  const COUNTDOWN_TEXT = 'Your download will start in';
  const DOWNLOAD_HEADING_RE = /^\s*Download\b/i;
  const COUNTDOWN_DELAY_MIN = 800;
  const COUNTDOWN_DELAY_MAX = 1200;

  const nativeSetTimeout = window.setTimeout.bind(window);

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
}

function isFlightsimAddonUrl(url: string | undefined): boolean {
  if (!url || !URL.canParse(url)) return false;
  const u = new URL(url);
  if (!ADDON_PATH_RE.test(u.pathname)) return false;
  return hostnameMatches(u.hostname, HOSTS);
}

export function initFlightsimDownloadPatch(): void {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading') return;
    const url = changeInfo.url ?? tab.url;
    void (async () => {
      if (!isFlightsimAddonUrl(url)) return;
      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: false },
          world: 'MAIN',
          injectImmediately: true,
          func: runFlightsimDownloadPatch,
        });
      } catch {}
    })();
  });
}
