import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost, whenDomReady } from '../../utils/domain-check';

const XDMOVIES_MAIN_WORLD_RUN = 'XDMOVIES_MAIN_WORLD_RUN' as const;
const MEDIATOR_PAGE_HOSTS = ['latestnewsonline.sbs'] as const;
const MSG_SOURCE = 'skip-wait-xdmovies';
const MSG_VISIBILITY = 'INJECT_VISIBILITY_SPOOF';
const OVERLAY_ID = 'skip-wait-xdmovies-overlay';
const PATH = /^\/(?:r|download)\/([^/]+)/;
const TIMER_SECONDS = 6;
const SERVER_WAIT_MS = TIMER_SECONDS * 2 * 1000;
const TURNSTILE_CONTAINER_ID = 'turnstileContainer';
const SITE_STYLE_ID = 'skip-wait-xdmovies-site-style';

type XdmoviesMainWorldPayload = {
  code: string;
  fingerprint: string;
  waitMs: number;
  msgSource: string;
};

type PhaseMessage = { source?: string; phase?: string; waitEndTs?: number; message?: string };

const isCloudflareInterstitial = (): boolean => {
  const title = document.title.toLowerCase();
  if (title.includes('just a moment') || title.includes('attention required')) return true;
  if (document.querySelector('#challenge-running, #cf-challenge-running, #challenge-stage')) return true;
  return false;
};

async function xdmoviesFingerprint(): Promise<string> {
  const cv = document.createElement('canvas');
  const x = cv.getContext('2d')!;
  x.textBaseline = 'top';
  x.font = '14px Arial';
  x.fillStyle = '#f60';
  x.fillRect(125, 1, 62, 20);
  x.fillStyle = '#069';
  x.fillText('XDMovies,🎬', 2, 15);
  x.fillStyle = 'rgba(102, 204, 0, 0.7)';
  x.fillText('XDMovies,🎬', 4, 17);
  const gl = document.createElement('canvas').getContext('webgl');
  const di = gl?.getExtension('WEBGL_debug_renderer_info');
  const nav = navigator as Navigator & { deviceMemory?: number };
  const seed = [
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.language,
    nav.platform,
    nav.hardwareConcurrency,
    nav.deviceMemory ?? '',
    cv.toDataURL().slice(-50),
    di && gl ? gl.getParameter(di.UNMASKED_RENDERER_WEBGL) : '',
    'ontouchstart' in window ? 'touch' : 'no_touch',
    nav.plugins.length,
    nav.cookieEnabled,
    nav.doNotTrack ?? '',
  ].join('|||');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function runMediatorPageFlow(code: string, fingerprint: string): Promise<void> {
  const ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: {
      lead: 'Hang tight — getting your download ready.',
      detail:
        "You don't need to tap anything on the page. We'll open your link automatically when it's done.",
    },
    status: 'Getting things ready…',
    countdownLabel: 'Your link opens in',
    countdownHint: 'If a checkbox appears below, tap it to confirm you’re human',
  });

  const stopChrome = pinSiteWidgetOverOverlay({
    overlayId: OVERLAY_ID,
    mount: ui.turnstileMount,
    widgetId: TURNSTILE_CONTAINER_ID,
    styleId: SITE_STYLE_ID,
  });

  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data as PhaseMessage;
    if (d?.source !== MSG_SOURCE || !d.phase) return;
    if (d.phase === 'parallel') {
      ui.setNote({
        lead: 'Almost there.',
        detail:
          "If a checkbox appears below, tap it to confirm you're human. Otherwise, just wait — your link opens here automatically.",
      });
      ui.setStatus('Waiting for your link to open…');
      ui.startCountdown(d.waitEndTs!);
      return;
    }
    if (d.phase === 'complete') {
      ui.stopCountdown();
      ui.setStatus('Almost ready…');
      return;
    }
    if (d.phase === 'redirect') {
      stopChrome();
      ui.setStatus('Opening your download…');
      return;
    }
    if (d.phase === 'error') {
      ui.hideCountdown();
      ui.setStatus('Something went wrong.');
      ui.setError(d.message!);
    }
  });

  ui.setStatus('Almost there…');
  chrome.runtime.sendMessage({
    type: XDMOVIES_MAIN_WORLD_RUN,
    payload: {
      code,
      fingerprint,
      waitMs: SERVER_WAIT_MS,
      msgSource: MSG_SOURCE,
    },
  });
}

export function initXdmoviesMediatorPage(): void {
  if (window !== window.top || !isAllowedHost(MEDIATOR_PAGE_HOSTS)) return;
  const code = location.pathname.match(PATH)?.[1];
  if (!code) return;
  void (async () => {
    const fingerprint = xdmoviesFingerprint();
    await whenDomReady(
      () =>
        !isCloudflareInterstitial() &&
        document.getElementById('card') !== null &&
        document.getElementById(TURNSTILE_CONTAINER_ID) !== null,
    );
    chrome.runtime.sendMessage({ type: MSG_VISIBILITY });
    await runMediatorPageFlow(code, await fingerprint);
  })();
}

export function runXdmoviesMainWorldFlow(P: XdmoviesMainWorldPayload): void {
  type Io = {
    on: (ev: string, fn: (...a: unknown[]) => void) => void;
    emit: (ev: string, ...a: unknown[]) => void;
    connected?: boolean;
    disconnect?: () => void;
  };
  type IoFactory = (a: unknown, o?: Record<string, unknown>) => Io;

  const post = (phase: string, extra?: Record<string, unknown>): void => {
    window.postMessage({ source: P.msgSource, phase, ...(extra ?? {}) }, location.origin);
  };

  const spoofVisibility = (): void => {
    try {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      Object.defineProperty(Document.prototype, 'hasFocus', { value: () => true, configurable: true, writable: true });
    } catch {}
  };

  const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

  const waitIo = (): Promise<IoFactory> =>
    new Promise((resolve) => {
      const w = window as unknown as Record<string, unknown>;
      const cur = w['io'];
      if (typeof cur === 'function') return resolve(cur as IoFactory);
      let v: unknown = cur;
      Object.defineProperty(w, 'io', {
        configurable: true,
        get: () => v,
        set: (x: unknown) => {
          v = x;
          if (typeof x === 'function') resolve(x as IoFactory);
        },
      });
    });

  const bindSocket = async (ioFn: IoFactory, bindToken: string): Promise<Io> => {
    const s = ioFn(undefined, { transports: ['websocket'] });
    const pulse = window.setInterval(() => {
      if (!s.connected) return;
      s.emit('heartbeat');
      s.emit('visibility', 'visible');
    }, 1000);
    await new Promise<void>((resolve, reject) => {
      s.on('connect', () => {
        s.emit('bind', bindToken);
        s.emit('visibility', 'visible');
      });
      s.on('bound', () => resolve());
      s.on('error', (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))));
      window.setTimeout(() => resolve(), 3000);
    });
    (s as Io & { __pulse?: number }).__pulse = pulse;
    return s;
  };

  const stopSocket = (s: Io | null): void => {
    if (!s) return;
    const pulse = (s as Io & { __pulse?: number }).__pulse;
    if (pulse) window.clearInterval(pulse);
    try {
      s.disconnect?.();
    } catch {}
  };

  const readTurnstileToken = (): string | null => {
    const value = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value ?? '';
    return value.length > 50 ? value : null;
  };

  const waitForTurnstileToken = (): Promise<string> =>
    new Promise((resolve) => {
      let done = false;
      const w = window as Window & { onTurnstileSuccess?: (token: string) => void };
      const finish = (token: string): void => {
        if (done || !token) return;
        done = true;
        mo.disconnect();
        resolve(token);
      };
      const prev = w.onTurnstileSuccess;
      w.onTurnstileSuccess = (token: string) => {
        try {
          prev?.(token);
        } catch {}
        finish(token);
      };
      const mo = new MutationObserver(() => {
        spoofVisibility();
        const token = readTurnstileToken();
        if (token) finish(token);
      });
      mo.observe(document.documentElement, {
        attributeFilter: ['value'],
        attributes: true,
        childList: true,
        subtree: true,
      });
      const existing = readTurnstileToken();
      if (existing) finish(existing);
    });

  void (async () => {
    let socket: Io | null = null;
    try {
      spoofVisibility();
      const waitEndTs = Date.now() + P.waitMs;
      post('parallel', { waitEndTs });
      const tokenPromise = waitForTurnstileToken();

      const sessionRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: P.code, fingerprint: P.fingerprint }),
      });
      const sessionJson = (await sessionRes.json()) as { sessionId?: string; token?: string; error?: string };
      if (!sessionJson.sessionId || !sessionJson.token) {
        throw new Error(sessionJson.error ?? `session ${sessionRes.status}`);
      }

      const ioFn = await waitIo();
      socket = await bindSocket(ioFn, sessionJson.token);

      const turnstileToken = await Promise.all([
        tokenPromise,
        sleep(Math.max(0, waitEndTs - Date.now())),
      ]).then(([token]) => token);

      post('complete');
      let completeBody: { token?: string; error?: string } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const completeRes = await fetch('/api/session/complete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: P.fingerprint, turnstileToken }),
        });
        completeBody = (await completeRes.json()) as { token?: string; error?: string };
        if (completeBody.token) break;
        const err = (completeBody.error ?? '').toLowerCase();
        if (!err.includes('timer') && !err.includes('wait')) break;
        await sleep(3000);
      }
      if (!completeBody?.token) throw new Error(completeBody?.error ?? 'complete failed');

      stopSocket(socket);
      post('redirect');
      location.href = `/go/${encodeURIComponent(sessionJson.sessionId)}?t=${encodeURIComponent(completeBody.token)}`;
    } catch (e) {
      stopSocket(socket);
      post('error', { message: String(e instanceof Error ? e.message : e) });
    }
  })();
}

export function initXdmoviesMainWorldInject(): void {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== XDMOVIES_MAIN_WORLD_RUN) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    chrome.scripting.executeScript({
      target: { tabId, frameIds: [sender.frameId ?? 0] },
      world: 'MAIN',
      func: runXdmoviesMainWorldFlow,
      args: [message.payload as XdmoviesMainWorldPayload],
    });
    return false;
  });
}
