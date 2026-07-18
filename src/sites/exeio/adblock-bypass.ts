export function runExeioAdblockBypass(): void {
  const w = window as unknown as { __swExeioAdblock?: boolean };
  if (w.__swExeioAdblock) return;
  w.__swExeioAdblock = true;

  const BAIT =
    /googlesyndication|doubleclick|pubmatic|taboola|adnxs|amazon-adsystem|adsbygoogle|adsboosters|netpub\.media|cleverwebserver|demand\.supply|portalfluently|protrafficinspector|sinisterblare|dampedvisored|llvpn|kettledroopingcontinuation|workdeadlinededicate|spendsdetachment|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|jsdelivr\.com|code\.jquery\.com|releases\.jquery\.com/i;

  const isBait = (url: unknown): boolean => BAIT.test(String(url ?? ''));

  let snap: string | null = null;
  let appVarsHooked = false;

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

  const forceAdblockOff = (): void => {
    try {
      const av = (window as unknown as { app_vars?: Record<string, unknown> }).app_vars;
      if (av) av['force_disable_adblock'] = '0';
    } catch {}
  };

  const hookAppVars = (): void => {
    if (appVarsHooked) return;
    appVarsHooked = true;
    try {
      let vars: Record<string, unknown> | undefined = (window as unknown as { app_vars?: Record<string, unknown> })
        .app_vars;
      Object.defineProperty(window, 'app_vars', {
        configurable: true,
        enumerable: true,
        get: () => vars,
        set: (v: Record<string, unknown>) => {
          vars = v && typeof v === 'object' ? v : vars;
          if (vars) vars['force_disable_adblock'] = '0';
        },
      });
      if (vars) vars['force_disable_adblock'] = '0';
    } catch {
      forceAdblockOff();
    }
  };

  const remountTurnstile = (): void => {
    const box = document.getElementById('captchaShortlink');
    const turnstile = (window as unknown as { turnstile?: { render: (el: string | HTMLElement, opts: object) => unknown } })
      .turnstile;
    const sitekey = (window as unknown as { app_vars?: { turnstile_site_key?: string } }).app_vars
      ?.turnstile_site_key;
    if (!box || !turnstile || !sitekey) {
      try {
        (window as unknown as { onloadTurnstileCallback?: () => void }).onloadTurnstileCallback?.();
      } catch {}
      return;
    }
    try {
      box.replaceChildren();
      turnstile.render(box, {
        sitekey,
        callback: (token: string) => {
          let input = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]');
          if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'cf-turnstile-response';
            box.appendChild(input);
          }
          input.value = token;
          const btn = document.getElementById('invisibleCaptchaShortlink');
          if (btn instanceof HTMLButtonElement) btn.disabled = false;
        },
      });
    } catch {
      try {
        (window as unknown as { onloadTurnstileCallback?: () => void }).onloadTurnstileCallback?.();
      } catch {}
    }
  };

  const takeSnap = (): void => {
    for (const id of ['link-view', 'before-captcha', 'go-link'] as const) {
      const f = document.getElementById(id);
      if (!f) continue;
      if (f.querySelector('.button.disabled.danger')) continue;
      if (f.querySelector('[name=_csrfToken], button[type=submit], [name=ad_form_data], [name=cf-turnstile-response]')) {
        snap = f.outerHTML;
        return;
      }
    }
  };

  const isGuttedForm = (f: Element): boolean =>
    !!f.querySelector('.button.disabled.danger') &&
    !f.querySelector('button[type=submit], [name=cf-turnstile-response], [name=ad_form_data]');

  const hasOrphanDanger = (): boolean => {
    const danger = document.querySelector('.button.disabled.danger');
    if (!danger) return false;
    return !document.querySelector('#before-captcha, #link-view, #go-link');
  };

  const enableButtons = (root: ParentNode): void => {
    for (const btn of root.querySelectorAll('button')) {
      if (btn instanceof HTMLButtonElement) btn.disabled = false;
    }
  };

  const restoreFromSnap = (): boolean => {
    if (!snap) return false;
    const wrap = document.createElement('div');
    wrap.innerHTML = snap;
    const next = wrap.querySelector('#link-view, #before-captcha, #go-link');
    if (!next) return false;
    const id = next.id;

    const existing = document.getElementById(id);
    if (existing) {
      if (!isGuttedForm(existing) && existing.querySelector('[name=_csrfToken], [name=cf-turnstile-response], [name=ad_form_data]')) {
        return false;
      }
      existing.replaceWith(next);
      enableButtons(next);
      return true;
    }

    const danger = document.querySelector('.button.disabled.danger');
    if (danger) {
      danger.replaceWith(next);
      enableButtons(next);
      return true;
    }

    const host = document.querySelector('.link-container');
    if (host) {
      const h4 = host.querySelector('h4');
      if (h4?.nextSibling) host.insertBefore(next, h4.nextSibling);
      else host.appendChild(next);
      enableButtons(next);
      return true;
    }

    return false;
  };

  const tick = (): void => {
    takeSnap();

    const gutted = (['before-captcha', 'link-view'] as const).some((id) => {
      const f = document.getElementById(id);
      return !!f && isGuttedForm(f);
    });
    const orphan = hasOrphanDanger();
    if (!gutted && !orphan) return;

    hookAppVars();
    forceAdblockOff();
    if (restoreFromSnap()) {
      queueMicrotask(remountTurnstile);
      window.setTimeout(remountTurnstile, 300);
    }
  };

  const boot = (): void => {
    takeSnap();
    tick();
    new MutationObserver(tick).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  boot();
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        takeSnap();
        tick();
      },
      { once: true },
    );
  }
}
