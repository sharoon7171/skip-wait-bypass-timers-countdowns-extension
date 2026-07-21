const SNAP_KEY = 'sw-cuty-form-snap';

const BAIT =
  /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|jsdelivr\.com|code\.jquery\.com|releases\.jquery\.com|pagead2\.googlesyndication|googlesyndication|static\.doubleclick|doubleclick|ads\.pubmatic|pubmatic|cdn\.taboola|taboola|ib\.adnxs|adnxs|c\.amazon-adsystem|amazon-adsystem|adsbygoogle|adsboosters|netpub\.media|sinisterblare/i;

const isBait = (url: unknown): boolean => BAIT.test(String(url ?? ''));

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => unknown;
  ready?: (cb: () => void) => void;
};

export function runCutyAdblockBypass(): void {
  const w = window as unknown as { __swCutyAdblock?: boolean };
  if (w.__swCutyAdblock) return;
  w.__swCutyAdblock = true;

  let snap: string | null = null;
  try {
    snap = sessionStorage.getItem(SNAP_KEY);
  } catch {}
  let remounted = false;

  type SwXhr = XMLHttpRequest & { __swMethod?: string; __swUrl?: string };
  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: SwXhr,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    this.__swMethod = method;
    this.__swUrl = String(url);
    return XO.call(this, method, url, async ?? true, username, password);
  };
  XMLHttpRequest.prototype.send = function (this: SwXhr, body?: Document | XMLHttpRequestBodyInit | null) {
    if (isBait(this.__swUrl) && String(this.__swMethod || '').toUpperCase() === 'HEAD') {
      Object.defineProperty(this, 'status', { configurable: true, get: () => 200 });
      Object.defineProperty(this, 'readyState', { configurable: true, get: () => 4 });
      Object.defineProperty(this, 'responseText', { configurable: true, get: () => '' });
      queueMicrotask(() => {
        this.onreadystatechange?.call(this, null as unknown as Event);
        this.onload?.call(this, null as unknown as ProgressEvent<EventTarget>);
      });
      return;
    }
    return XS.call(this, body);
  };

  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ||
      (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') ||
      'GET'
    ).toUpperCase();
    if (isBait(url) && method === 'HEAD') {
      return Promise.resolve(new Response(null, { status: 200, statusText: 'OK' }));
    }
    return _fetch(input, init);
  };

  const takeSnap = (): void => {
    const form = document.getElementById('free-submit-form');
    if (!form?.querySelector('#turnstile-container, .cf-turnstile')) return;
    const clone = form.cloneNode(true) as HTMLElement;
    clone.querySelector('#turnstile-container, .cf-turnstile')?.replaceChildren();
    snap = clone.outerHTML;
    try {
      sessionStorage.setItem(SNAP_KEY, snap);
    } catch {}
  };

  const remountTurnstile = (): void => {
    if (remounted) return;
    const box = document.getElementById('turnstile-container');
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!box || !turnstile) return;
    if (box.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"], iframe')) {
      remounted = true;
      return;
    }
    const sitekey = box.getAttribute('data-sitekey');
    if (!sitekey) return;

    const paint = (): void => {
      const live = document.getElementById('turnstile-container');
      if (!live || remounted) return;
      if (live.querySelector('iframe')) {
        remounted = true;
        return;
      }
      try {
        remounted = true;
        live.replaceChildren();
        turnstile.render(live, {
          sitekey,
          theme: live.getAttribute('data-theme') || 'light',
          language: live.getAttribute('data-language') || 'en',
          callback: (token: string) => {
            let input = live.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
            if (!input) {
              input = document.createElement('input');
              input.type = 'hidden';
              input.name = 'cf-turnstile-response';
              live.appendChild(input);
            }
            input.value = token;
            const btn = document.getElementById('submit-button');
            if (btn instanceof HTMLButtonElement) btn.disabled = false;
            try {
              (window as unknown as { onTurnstileSuccess?: (t: string) => void }).onTurnstileSuccess?.(token);
            } catch {}
          },
        });
      } catch {
        remounted = false;
      }
    };

    if (typeof turnstile.ready === 'function') {
      try {
        turnstile.ready(paint);
        return;
      } catch {}
    }
    paint();
  };

  const restoreFromSnap = (): boolean => {
    if (!snap) return false;
    const ab = document.querySelector('button.ab');
    if (!ab || document.getElementById('free-submit-form')) return false;
    const wrap = document.createElement('div');
    wrap.innerHTML = snap;
    const next = wrap.querySelector('#free-submit-form');
    if (!next) return false;
    remounted = false;
    ab.replaceWith(next);
    return true;
  };

  const tick = (): void => {
    takeSnap();
    if (restoreFromSnap()) {
      queueMicrotask(remountTurnstile);
      window.setTimeout(remountTurnstile, 400);
      return;
    }
  };

  tick();
  new MutationObserver(tick).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  const id = window.setInterval(tick, 500);
  window.setTimeout(() => window.clearInterval(id), 90_000);
}
