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
type IoFactory = (a: unknown, o?: Record<string, unknown>) => Io;
type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => void };

export function runXdmoviesMainWorldFlow(P: XdmoviesMainWorldPayload): void {
  const post = (phase: string, extra?: Record<string, unknown>): void => {
    window.postMessage({ source: P.msgSource, phase, ...(extra ?? {}) }, location.origin);
  };

  const trapGlobal = <T>(key: string, ready: (v: T) => boolean): Promise<T> =>
    new Promise<T>((resolve) => {
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

  void (async () => {
    try {
      const waitEndTs = Date.now() + P.waitMs;
      post('parallel', { waitEndTs });

      const sessionPromise = fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: P.code, fingerprint: P.fingerprint }),
      }).then((r) => r.json() as Promise<{ sessionId: string; token: string }>);

      const ioPromise = trapGlobal<IoFactory>('io', (v) => typeof v === 'function');

      const bindPromise = (async () => {
        const [sess, ioFn] = await Promise.all([sessionPromise, ioPromise]);
        await new Promise<void>((resolve, reject) => {
          const s = ioFn(undefined, { transports: ['websocket'] });
          setInterval(() => {
            if (s.connected) s.emit('heartbeat');
          }, 100);
          s.on('connect', () => {
            s.emit('bind', sess.token);
            s.emit('visibility', 'visible');
          });
          s.on('bound', () => resolve());
          s.on('error', (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))));
        });
        return sess;
      })();

      const tokenPromise = (async () => {
        const box = document.getElementById('turnstileContainer');
        box?.classList.remove('hidden');
        const el =
          (document.getElementById('turnstileWidget') as HTMLElement | null) ??
          (box ?? document.body).appendChild(
            Object.assign(document.createElement('div'), { id: 'turnstileWidget' }),
          );
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const ts = await trapGlobal<Turnstile>('turnstile', (v) => typeof v?.render === 'function');
        const readExistingToken = (): string | null => {
          const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
          const value = input?.value ?? '';
          return value.length > 50 ? value : null;
        };
        return new Promise<string>((resolve) => {
          let pollId: number | undefined;
          const finish = (token: string): void => {
            if (pollId !== undefined) clearInterval(pollId);
            resolve(token);
          };
          const existing = readExistingToken();
          if (existing) {
            finish(existing);
            return;
          }
          try {
            ts.render(el, {
              sitekey: P.sitekey,
              callback: finish,
              'error-callback': () => post('turnstile_error'),
              'expired-callback': () => post('turnstile_expired'),
            });
          } catch {}
          pollId = window.setInterval(() => {
            const v = readExistingToken();
            if (v) finish(v);
          }, 250);
        });
      })();

      const serverReady = new Promise<void>((r) => {
        const remain = waitEndTs - Date.now();
        if (remain <= 0) r();
        else setTimeout(r, remain);
      });

      const [sess, tok] = await Promise.all([bindPromise, tokenPromise, serverReady]).then(
        ([s, t]) => [s, t] as const,
      );

      post('complete');
      const cr = await fetch('/api/session/complete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: P.fingerprint, turnstileToken: tok }),
      });
      const body = (await cr.json()) as { token: string };
      post('redirect');
      window.location.href = `/go/${encodeURIComponent(sess.sessionId)}?t=${encodeURIComponent(body.token)}`;
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
