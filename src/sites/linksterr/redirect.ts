import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost } from '../../utils/domain-check';
import { LINKSTERR_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-linksterr-gateway';
const PATH_RE = /^\/r\/[^/]+\/?$/i;
const DEST_RE = /\bdata-destination=["'](https?:\/\/[^"']+)["']/i;

function isCfChallenge(): boolean {
  if (document.getElementById('js-data')) return false;
  if (/just a moment/i.test(document.title)) return true;
  if (document.querySelector('#challenge-form, #cf-challenge-running, .cf-browser-verification')) {
    return true;
  }
  return (document.documentElement?.innerHTML ?? '').includes('cdn-cgi/challenge-platform');
}

function destFromDom(): string | null {
  const v = document.getElementById('js-data')?.getAttribute('data-destination')?.trim() ?? '';
  return /^https?:\/\//i.test(v) ? v : null;
}

function destFromHtml(html: string): string | null {
  if (/just a moment|cdn-cgi\/challenge-platform/i.test(html)) return null;
  return html.match(DEST_RE)?.[1] ?? null;
}

function go(url: string): void {
  try {
    createFullPageOverlay({
      id: OVERLAY_ID,
      brand: 'Skip Wait',
      note: { lead: 'Bypassing Link$terr…', detail: "You don't need to wait or watch ads." },
      status: 'Opening your link…',
    });
  } catch {}
  try {
    window.stop();
  } catch {}
  location.replace(url);
}

export function initLinksterrGateway(): void {
  if (!isAllowedHost(LINKSTERR_HOSTS) || !PATH_RE.test(location.pathname)) return;

  let done = false;
  let busy = false;
  const mo = new MutationObserver(tick);
  const poll = window.setInterval(tick, 500);

  function stopWatching(): void {
    mo.disconnect();
    window.clearInterval(poll);
  }

  function finish(url: string): void {
    if (done) return;
    done = true;
    stopWatching();
    go(url);
  }

  function tick(): void {
    if (done || isCfChallenge()) return;
    const dom = destFromDom();
    if (dom) return finish(dom);
    if (busy) return;
    busy = true;
    void fetch(location.href, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((html) => {
        const url = destFromHtml(html);
        if (url) finish(url);
      })
      .catch(() => {})
      .finally(() => {
        busy = false;
      });
  }

  document.documentElement &&
    mo.observe(document.documentElement, {
      attributeFilter: ['data-destination'],
      attributes: true,
      childList: true,
      subtree: true,
    });
  tick();
  window.setTimeout(stopWatching, 60_000);
  document.addEventListener('DOMContentLoaded', tick, { once: true });
  window.addEventListener('load', tick, { once: true });
}
