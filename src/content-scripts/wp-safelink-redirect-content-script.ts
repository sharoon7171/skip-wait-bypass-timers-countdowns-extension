const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;
const scriptsWithNoSafelinkUrl = new WeakSet<Element>();

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
  const tryGo = (): boolean => {
    const url = getSafelinkRedirectUrl();
    if (!url) return false;
    window.location.href = url;
    return true;
  };

  if (tryGo()) return;
  if (document.readyState === 'complete') return;
  if (document.readyState === 'interactive' && !hasSafelinkHint()) return;

  const root = document.documentElement;
  if (!root) return;

  let mo: MutationObserver | null = null;
  let moRaf = 0;
  function teardown(): void {
    if (moRaf) {
      cancelAnimationFrame(moRaf);
      moRaf = 0;
    }
    mo?.disconnect();
    mo = null;
    document.removeEventListener('readystatechange', onState);
  }
  const onState = (): void => {
    if (document.readyState === 'loading') return;
    if (tryGo()) return teardown();
    if (document.readyState === 'interactive' && !hasSafelinkHint()) teardown();
    else if (document.readyState === 'complete') teardown();
  };
  mo = new MutationObserver(() => {
    if (moRaf) return;
    moRaf = requestAnimationFrame(() => {
      moRaf = 0;
      if (tryGo()) teardown();
    });
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener('readystatechange', onState);
  if (document.readyState !== 'loading') onState();
}

initWpSafelinkRedirect();
