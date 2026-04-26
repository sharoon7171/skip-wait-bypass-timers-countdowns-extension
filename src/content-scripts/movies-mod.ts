import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'movies-mod';
const STYLE_ID = 'skipwait-movies-mod-timed-content';

function injectBypassStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent =
    '[class*="timed-content-client_show"]{display:block!important}[class*="timed-content-client_hide"]{display:none!important}';
  document.documentElement.appendChild(el);
}

export function initMoviesModContentScript(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  injectBypassStyle();
}
