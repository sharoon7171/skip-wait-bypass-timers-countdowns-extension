const HOST = 'iframe.coomeet.com';
const MIN_MS = 400;
const MAX_MS = 600_000;
const FACTOR = 30;
const FLAG = '__skipWaitCoomeetTimers';

function installAcceleratedTimers(): void {
  const nativeSetTimeout = window.setTimeout.bind(window) as typeof window.setTimeout;
  const nativeSetInterval = window.setInterval.bind(window) as typeof window.setInterval;
  const scale = (ms: number | undefined): number | undefined => {
    if (typeof ms !== 'number' || ms < MIN_MS || ms > MAX_MS) return ms;
    return Math.max(0, Math.floor(ms / FACTOR));
  };
  window.setTimeout = function (handler: TimerHandler, timeout?: number, ...args: unknown[]) {
    return nativeSetTimeout(handler, scale(timeout) as number | undefined, ...args);
  } as typeof setTimeout;
  window.setInterval = function (handler: TimerHandler, timeout?: number, ...args: unknown[]) {
    const t = scale(timeout);
    const safe = typeof t === 'number' ? Math.max(1, t) : t;
    return nativeSetInterval(handler, safe as number | undefined, ...args);
  } as typeof setInterval;
}

export function runCoomeetMainWorldAccelerator(): void {
  const w = window as unknown as Record<string, boolean | undefined>;
  if (w[FLAG]) return;
  w[FLAG] = true;
  installAcceleratedTimers();
}

export function isOnCoomeetIframeHost(): boolean {
  try {
    return new URL(window.location.href).hostname === HOST;
  } catch {
    return false;
  }
}

export function initCoomeetIframeBootstrap(): void {
  if (!isOnCoomeetIframeHost()) return;
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    chrome.runtime.sendMessage({ type: 'SKIP_WAIT_COOMEET_MAIN' }).catch(() => {});
    return;
  }
  runCoomeetMainWorldAccelerator();
}
