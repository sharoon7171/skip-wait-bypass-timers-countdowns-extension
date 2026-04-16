const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;
const OVERLAY_ID = 'skip-wait-wp-safelink-overlay';
const scriptsWithNoSafelinkUrl = new WeakSet<Element>();

function overlayCss(): string {
  const o = OVERLAY_ID;
  return `#${o}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 0;box-sizing:border-box;background:rgba(15,23,42,.92);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc}#${o} .sw-card{max-width:420px;width:100%;border-radius:16px;padding:28px 24px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5);pointer-events:none}#${o} .sw-brand{font-size:1.35rem;font-weight:700;letter-spacing:-.02em;color:#38bdf8;margin-bottom:8px}#${o} .sw-note{font-size:.875rem;line-height:1.55;color:#cbd5e1;margin-bottom:16px}#${o} .sw-note strong{color:#e2e8f0;font-weight:600}#${o} .sw-status{font-size:.9rem;color:#e2e8f0;min-height:1.4em}`;
}

function createWpSafelinkOverlay(): { root: HTMLElement; setStatus: (t: string) => void } {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  const st = document.createElement('style');
  st.textContent = overlayCss();
  root.appendChild(st);
  const card = document.createElement('div');
  card.className = 'sw-card';
  const brand = document.createElement('div');
  brand.className = 'sw-brand';
  brand.textContent = 'Skip Wait';
  const note = document.createElement('div');
  note.className = 'sw-note';
  note.innerHTML =
    '<strong>Skip Wait is handling this safelink.</strong> We read the real destination from the page and skip extra steps—stay on this tab; we redirect automatically when the link is available.';
  const status = document.createElement('div');
  status.className = 'sw-status';
  status.textContent = 'Scanning the page…';
  card.append(brand, note, status);
  root.appendChild(card);
  return {
    root,
    setStatus: (t: string) => {
      status.textContent = t;
    },
  };
}

function getSafelinkRedirectUrl(): string | null {
  const href = document.querySelector<HTMLAnchorElement>('a[href*="safelink_redirect"]')?.href?.trim();
  if (href && /^https?:\/\//.test(href)) return href;
  for (const script of document.scripts) {
    if (scriptsWithNoSafelinkUrl.has(script)) continue;
    const m = script.textContent?.match(SAFELINK_RE);
    if (m?.[0]) return m[0];
    scriptsWithNoSafelinkUrl.add(script);
  }
  return null;
}

function hasSafelinkHint(): boolean {
  if (document.querySelector('a[href*="safelink_redirect"]')) return true;
  for (const s of document.scripts) {
    if (s.textContent?.includes('safelink_redirect')) return true;
  }
  return false;
}

function initWpSafelinkRedirect(): void {
  let overlay: { root: HTMLElement; setStatus: (t: string) => void } | null = null;
  let mo: MutationObserver | null = null;
  let moRaf = 0;
  let redirected = false;
  let stopped = false;

  const ensureOverlay = (): void => {
    if (overlay) return;
    if (!hasSafelinkHint() && !getSafelinkRedirectUrl()) return;
    overlay = createWpSafelinkOverlay();
    document.documentElement.appendChild(overlay.root);
  };

  const stop = (removeOverlay: boolean): void => {
    if (stopped) return;
    stopped = true;
    if (moRaf) {
      cancelAnimationFrame(moRaf);
      moRaf = 0;
    }
    mo?.disconnect();
    mo = null;
    document.removeEventListener('readystatechange', onState);
    if (removeOverlay) {
      overlay?.root.remove();
      overlay = null;
    }
  };

  const tryGo = (): boolean => {
    if (redirected) return true;
    const url = getSafelinkRedirectUrl();
    if (!url) return false;
    redirected = true;
    ensureOverlay();
    overlay?.setStatus('Redirecting…');
    stop(false);
    window.location.href = url;
    return true;
  };

  const onState = (): void => {
    if (document.readyState === 'loading') return;
    if (tryGo()) return;
    if (hasSafelinkHint()) ensureOverlay();
    if (document.readyState === 'interactive' && !hasSafelinkHint()) stop(true);
    else if (document.readyState === 'complete') stop(true);
  };

  if (tryGo()) return;
  if (document.readyState === 'complete') return;
  if (document.readyState === 'interactive' && !hasSafelinkHint()) return;

  const root = document.documentElement;
  if (!root) return;

  mo = new MutationObserver(() => {
    if (redirected || stopped || moRaf) return;
    moRaf = requestAnimationFrame(() => {
      moRaf = 0;
      if (redirected || stopped) return;
      if (tryGo()) return;
      if (hasSafelinkHint()) ensureOverlay();
    });
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('readystatechange', onState);
  if (document.readyState !== 'loading') onState();
}

initWpSafelinkRedirect();
