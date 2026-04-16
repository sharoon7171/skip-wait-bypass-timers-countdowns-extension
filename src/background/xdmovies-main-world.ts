export const XDMOVIES_MAIN_WORLD_RUN = 'XDMOVIES_MAIN_WORLD_RUN' as const;

export type XdmoviesMainWorldPayload = {
  code: string;
  fingerprint: string;
  waitMs: number;
  sitekey: string;
  msgSource: string;
};

type Io = {
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
  emit: (ev: string, ...args: unknown[]) => void;
  connected?: boolean;
};

export function runXdmoviesMainWorldFlow(payload: XdmoviesMainWorldPayload): void {
  const P = payload;
  const src = P.msgSource;
  const post = (phase: string, extra?: Record<string, unknown>): void => {
    try {
      window.postMessage(Object.assign({ source: src, phase }, extra ?? {}), location.origin);
    } catch {}
  };
  const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  void (async () => {
    try {
      post('session');
      const sessRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: P.code, fingerprint: P.fingerprint }),
      });
      const sess = (await sessRes.json()) as { sessionId?: string; token?: string; error?: string };
      if (!sess.sessionId) throw new Error(sess.error ?? 'Could not start session');
      const sid = sess.sessionId;

      const ioFn = await new Promise<(a: unknown, o?: Record<string, unknown>) => Io>((resolve, reject) => {
        const end = Date.now() + 15000;
        const poll = (): void => {
          const io = (window as unknown as { io?: (a: unknown, o?: Record<string, unknown>) => Io }).io;
          if (typeof io === 'function') resolve(io);
          else if (Date.now() > end) reject(new Error('Socket.IO not loaded'));
          else setTimeout(poll, 0);
        };
        poll();
      });

      await new Promise<void>((resolve, reject) => {
        const to = window.setTimeout(() => reject(new Error('Connection timed out')), 12000);
        const s = ioFn(undefined, { transports: ['websocket'] });
        window.setInterval(() => {
          if (s.connected) s.emit('heartbeat');
        }, 100);
        s.on('connect', () => {
          s.emit('bind', sess.token);
          s.emit('visibility', 'visible');
        });
        s.on('bound', () => {
          window.clearTimeout(to);
          resolve();
        });
        s.on('error', (e: unknown) => {
          window.clearTimeout(to);
          reject(e instanceof Error ? e : new Error(String(e)));
        });
      });

      const waitEndTs = Date.now() + P.waitMs;
      post('parallel', { waitEndTs });

      const box = document.getElementById('turnstileContainer');
      if (box) box.classList.remove('hidden');
      let el = document.getElementById('turnstileWidget') as HTMLElement | null;
      if (!el) {
        el = document.createElement('div');
        el.id = 'turnstileWidget';
        (box ?? document.body).appendChild(el);
      }
      el.scrollIntoView({ block: 'center', behavior: 'instant' });

      const tokenPromise = new Promise<string>((resolve, reject) => {
        const dl = Date.now() + 120000;
        const run = (): void => {
          if (Date.now() > dl) {
            reject(new Error('Verification timed out'));
            return;
          }
          const ts = (window as unknown as { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => void } })
            .turnstile;
          if (!ts?.render) {
            requestAnimationFrame(run);
            return;
          }
          ts.render(el, {
            sitekey: P.sitekey,
            callback: resolve,
            'error-callback': () => post('turnstile_error'),
            'expired-callback': () => post('turnstile_expired'),
          });
        };
        run();
      });

      const serverReady = (async (): Promise<void> => {
        while (Date.now() < waitEndTs) await tick(8);
      })();

      const [tok] = await Promise.all([tokenPromise, serverReady]);

      post('complete');
      const cr = await fetch('/api/session/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: P.fingerprint, turnstileToken: tok }),
      });
      const body = (await cr.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!cr.ok || !body.token) throw new Error(body.error ?? 'Could not unlock link');
      post('redirect');
      window.location.href = `/go/${encodeURIComponent(sid)}?t=${encodeURIComponent(body.token)}`;
    } catch (e) {
      post('error', { message: String(e instanceof Error ? e.message : e) });
    }
  })();
}

export function initXdmoviesMainWorldInject(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== XDMOVIES_MAIN_WORLD_RUN) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ ok: false, error: 'No tab' });
      return false;
    }
    const frameId = sender.frameId ?? 0;
    chrome.scripting
      .executeScript({
        target: { tabId, frameIds: [frameId] },
        world: 'MAIN',
        func: runXdmoviesMainWorldFlow,
        args: [message.payload as XdmoviesMainWorldPayload],
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      );
    return true;
  });
}
