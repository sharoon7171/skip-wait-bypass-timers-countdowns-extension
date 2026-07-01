import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost, whenDomReady } from '../../utils/domain-check';
import { isCloudflareInterstitial } from '../../utils/cloudflare-verifier';

const XDMOVIES_MAIN_WORLD_RUN = 'XDMOVIES_MAIN_WORLD_RUN' as const;
const MEDIATOR_PAGE_HOSTS = ['latestnewsonline.sbs'] as const;
const MSG_SOURCE = 'skip-wait-xdmovies';
const MSG_VISIBILITY = 'INJECT_VISIBILITY_SPOOF';
const OVERLAY_ID = 'skip-wait-xdmovies-overlay';
const PATH = /^\/(?:r|download)\/([^/]+)/;
const SERVER_WAIT_MS = 10_500;
const TURNSTILE_SITEKEY = '0x4AAAAAACwMJhFoINTv6AGb';

type XdmoviesMainWorldPayload = {
  code: string;
  fingerprint: string;
  waitMs: number;
  sitekey: string;
  msgSource: string;
  turnstileMountId: string;
};

type PhaseMessage = { source?: string; phase?: string; waitEndTs?: number; message?: string };

const mediatorReady = (): boolean =>
  !isCloudflareInterstitial() && document.getElementById('turnstileContainer') !== null;

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

function attachTurnstile(mount: HTMLElement): void {
  const box = document.getElementById('turnstileContainer');
  if (!box) return;
  if (box.parentElement !== mount) mount.appendChild(box);
  box.classList.remove('hidden');
}

async function runMediatorPageFlow(code: string, fingerprint: string): Promise<void> {
  const ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    noteHtml:
      '<strong>Hang tight — getting your download ready.</strong> You don’t need to tap anything on the page. We’ll open your link automatically when it’s done.',
    status: 'Getting things ready…',
    countdownLabel: 'Your link opens in',
    countdownHint: 'If a checkbox appears below, tap it to confirm you’re human',
  });
  attachTurnstile(ui.turnstileMount);

  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data as PhaseMessage;
    if (d?.source !== MSG_SOURCE || !d.phase) return;
    if (d.phase === 'parallel') {
      ui.setNote(
        '<strong>Almost there.</strong> If a checkbox appears below, tap it to confirm you’re human. Otherwise, just wait — your link opens here automatically.',
      );
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
      ui.setStatus('Opening your download…');
      return;
    }
    if (d.phase === 'turnstile_error' || d.phase === 'turnstile_expired') {
      ui.setStatus('That check didn’t go through. Wait a moment or refresh the page.');
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
      sitekey: TURNSTILE_SITEKEY,
      msgSource: MSG_SOURCE,
      turnstileMountId: ui.turnstileMount.id,
    },
  });
}

export function initXdmoviesMediatorPage(): void {
  if (window !== window.top || !isAllowedHost(MEDIATOR_PAGE_HOSTS)) return;
  const code = location.pathname.match(PATH)?.[1];
  if (!code) return;
  void (async () => {
    const fingerprint = xdmoviesFingerprint();
    await whenDomReady(mediatorReady);
    chrome.runtime.sendMessage({ type: MSG_VISIBILITY });
    await runMediatorPageFlow(code, await fingerprint);
  })();
}

export function runXdmoviesMainWorldFlow(P: XdmoviesMainWorldPayload): void {
  type Io = { on: (ev: string, fn: (...a: unknown[]) => void) => void; emit: (ev: string, ...a: unknown[]) => void; connected?: boolean };
  type IoFactory = (a: unknown, o?: Record<string, unknown>) => Io;
  type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset?: (id?: string) => void };

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

  const trapGlobal = <T>(key: string, ready: (v: T) => boolean): Promise<T> =>
    new Promise((resolve) => {
      const w = window as unknown as Record<string, unknown>;
      const cur = w[key] as T | undefined;
      if (cur !== undefined && ready(cur)) return resolve(cur);
      let v: unknown = cur;
      Object.defineProperty(w, key, {
        configurable: true,
        get: () => v,
        set: (x: unknown) => {
          v = x;
          if (x !== undefined && ready(x as T)) resolve(x as T);
        },
      });
    });

  const turnstileEl = (): HTMLElement => {
    const mount = document.getElementById(P.turnstileMountId);
    if (!mount) throw new Error('turnstile mount missing');
    return (
      (mount.querySelector('#turnstileWidget') as HTMLElement | null) ??
      mount.appendChild(Object.assign(document.createElement('div'), { id: 'turnstileWidget' }))
    );
  };

  const turnstileToken = (): string | null => {
    const value = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value ?? '';
    return value.length > 50 ? value : null;
  };

  void (async () => {
    try {
      spoofVisibility();
      const waitEndTs = Date.now() + P.waitMs;
      post('parallel', { waitEndTs });

      const sessionPromise = fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: P.code, fingerprint: P.fingerprint }),
      }).then(async (r) => {
        const json = (await r.json()) as { sessionId?: string; token?: string; error?: string };
        if (!json.sessionId || !json.token) throw new Error(json.error ?? `session ${r.status}`);
        return json as { sessionId: string; token: string };
      });

      const bindPromise = trapGlobal<IoFactory>('io', (v) => typeof v === 'function').then(async (ioFn) => {
        const sess = await sessionPromise;
        await new Promise<void>((resolve, reject) => {
          const s = ioFn(undefined, { transports: ['websocket'] });
          const pulse = window.setInterval(() => {
            if (!s.connected) return;
            s.emit('heartbeat');
            s.emit('visibility', 'visible');
          }, 1000);
          s.on('connect', () => {
            s.emit('bind', sess.token);
            s.emit('visibility', 'visible');
          });
          s.on('bound', () => {
            clearInterval(pulse);
            resolve();
          });
          s.on('error', (e: unknown) => {
            clearInterval(pulse);
            reject(e instanceof Error ? e : new Error(String(e)));
          });
        });
        return sess;
      });

      const tokenPromise = trapGlobal<Turnstile>('turnstile', (v) => typeof v?.render === 'function').then(
        (ts) =>
          new Promise<string>((resolve) => {
            let mo: MutationObserver;
            const finish = (token: string): void => {
              mo.disconnect();
              resolve(token);
            };
            const existing = turnstileToken();
            if (existing) return finish(existing);
            const el = turnstileEl();
            if (!el.querySelector('iframe, input')) {
              try {
                ts.render(el, {
                  sitekey: P.sitekey,
                  theme: 'dark',
                  size: 'normal',
                  callback: finish,
                  'error-callback': () => post('turnstile_error'),
                  'expired-callback': () => post('turnstile_expired'),
                });
              } catch {
                ts.reset?.();
              }
            }
            mo = new MutationObserver(() => {
              spoofVisibility();
              const token = turnstileToken();
              if (token) finish(token);
            });
            mo.observe(document.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['value'],
            });
          }),
      );

      const serverReady = new Promise<void>((resolve) => {
        const remain = waitEndTs - Date.now();
        if (remain <= 0) resolve();
        else window.setTimeout(resolve, remain);
      });

      const [sess, tok] = await Promise.all([bindPromise, tokenPromise, serverReady]).then(([s, t]) => [s, t] as const);

      post('complete');
      const cr = await fetch('/api/session/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: P.fingerprint, turnstileToken: tok }),
      });
      const body = (await cr.json()) as { token?: string; error?: string };
      if (!body.token) throw new Error(body.error ?? `complete ${cr.status}`);
      post('redirect');
      location.href = `/go/${encodeURIComponent(sess.sessionId)}?t=${encodeURIComponent(body.token)}`;
    } catch (e) {
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
