const ALLOWED_HOSTNAMES: readonly string[] = ['episodes.modpro.blog'];

const STYLE_ID = 'skipwait-movies-mod-timed-content';

function isAllowedMoviesModHost(): boolean {
  try {
    const h = new URL(window.location.href).hostname.toLowerCase();
    return ALLOWED_HOSTNAMES.includes(h);
  } catch {
    return false;
  }
}

function injectBypassStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent =
    '[class*="timed-content-client_show"]{display:block!important}[class*="timed-content-client_hide"]{display:none!important}';
  document.documentElement.appendChild(el);
}

export function initMoviesModContentScript(): void {
  if (!isAllowedMoviesModHost()) return;
  injectBypassStyle();
}
