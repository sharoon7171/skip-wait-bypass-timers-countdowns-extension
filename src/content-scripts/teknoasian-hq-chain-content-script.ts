import { isAllowedHost } from '../utils/domain-check';

const ALLOWED_HOSTS = ['teknoasian.com'] as const;
const LL_PAYLOAD_RE = /var LLPayload = '([^']+)'/;
const MICRO_TRIES = 128;
const OBS_MS = 8000;

function extractSafelinkHw(): string | null {
  for (const script of document.querySelectorAll('script:not([src])')) {
    const t = script.textContent ?? '';
    if (!t.includes('LLPayload') || !t.includes('humanVerify')) continue;
    const m = t.match(LL_PAYLOAD_RE);
    if (m?.[1]) return m[1];
  }
  return null;
}

function parseHwPostHtml(html: string): { action: string | null; hq: string | null } {
  const action = html.match(/action=(['"])(https?:\/\/[^'"]+)\1/i)?.[2] ?? null;
  const hq =
    html.match(/name=['"]hq['"][^>]*value=['"]([^'"]+)['"]/i)?.[1] ??
    html.match(/value=['"]([^'"]+)['"][^>]*name=['"]hq['"]/i)?.[1] ??
    null;
  return {
    action: action && /^https?:\/\//.test(action) ? action : null,
    hq,
  };
}

function parseArticleHwNextUrl(html: string): string | null {
  const m =
    html.match(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*\bid=["']xxc["']/i) ||
    html.match(/<a[^>]+id=["']xxc["'][^>]+href=["'](https?:\/\/[^"']+)["']/i);
  const u = m?.[1];
  return u && /^https?:\/\//.test(u) ? u : null;
}

function postForm(url: string, hw: string): Promise<string> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ hw }).toString(),
    cache: 'no-store',
  }).then((r) => (r.ok ? r.text() : ''));
}

function submitHq(action: string, hq: string): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'hq';
  input.value = hq;
  form.appendChild(input);
  (document.body ?? document.documentElement).appendChild(form);
  form.submit();
}

function whenSafelinkReady(run: (hw: string) => void): void {
  let done = false;
  let obs: MutationObserver | null = null;
  const finish = (hw: string): void => {
    if (done) return;
    done = true;
    obs?.disconnect();
    obs = null;
    run(hw);
  };
  const tryRun = (): void => {
    const hw = extractSafelinkHw();
    if (hw) finish(hw);
  };
  tryRun();
  if (done) return;
  let micro = 0;
  const microBurst = (): void => {
    if (done) return;
    tryRun();
    if (done) return;
    if (++micro < MICRO_TRIES) queueMicrotask(microBurst);
  };
  queueMicrotask(microBurst);
  obs = new MutationObserver(() => tryRun());
  obs.observe(document.documentElement, { childList: true, subtree: true });
  tryRun();
  window.setTimeout(() => {
    obs?.disconnect();
    obs = null;
  }, OBS_MS);
}

function chainHome(): void {
  whenSafelinkReady((hw) => {
    void postForm(`${location.origin}/`, hw)
      .then((html) => {
        const { action, hq } = parseHwPostHtml(html);
        if (action && hq) submitHq(action, hq);
      })
      .catch(() => {});
  });
}

function chainArticle(): void {
  whenSafelinkReady((hw) => {
    void postForm(location.href, hw)
      .then((html) => {
        const next = parseArticleHwNextUrl(html);
        if (next) window.location.replace(next);
      })
      .catch(() => {});
  });
}

export function initTeknoasianHqChain(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  try {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/') chainArticle();
    else chainHome();
  } catch {}
}
