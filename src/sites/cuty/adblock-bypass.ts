const SNAP_KEY = 'sw-cuty-form-snap';

export function runCutyAdblockBypass(): void {
  const w = window as unknown as { __swCutyAdblock?: boolean };
  if (w.__swCutyAdblock) return;
  w.__swCutyAdblock = true;

  let snap: string | null = null;
  try {
    snap = sessionStorage.getItem(SNAP_KEY);
  } catch {}
  let remounted = false;

  const takeSnap = (): void => {
    const form = document.getElementById('free-submit-form');
    if (!form?.querySelector('#turnstile-container, .cf-turnstile')) return;
    snap = form.outerHTML;
    try {
      sessionStorage.setItem(SNAP_KEY, snap);
    } catch {}
  };

  const remountTurnstile = (): void => {
    if (remounted) return;
    const box = document.getElementById('turnstile-container');
    const turnstile = (window as unknown as {
      turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => unknown; ready?: (cb: () => void) => void };
    }).turnstile;
    if (!box || !turnstile || box.querySelector('iframe')) {
      if (box?.querySelector('iframe')) remounted = true;
      return;
    }
    const sitekey = box.getAttribute('data-sitekey');
    if (!sitekey) return;

    const paint = (): void => {
      const live = document.getElementById('turnstile-container');
      if (!live || remounted || live.querySelector('iframe')) {
        if (live?.querySelector('iframe')) remounted = true;
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

  const tick = (): void => {
    takeSnap();
    if (!snap) return;
    const ab = document.querySelector('button.ab');
    if (!ab || document.getElementById('free-submit-form')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = snap;
    const next = wrap.querySelector('#free-submit-form');
    if (!next) return;
    remounted = false;
    ab.replaceWith(next);
    window.setTimeout(remountTurnstile, 400);
  };

  tick();
  const id = window.setInterval(tick, 500);
  window.setTimeout(() => window.clearInterval(id), 45_000);
}
