import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['teknoasian.com'] as const;
const OVERLAY_ID = 'skip-wait-ll-safelink-overlay';
const LL_RE = /var LLPayload = '([^']+)'/;
const HQ_RE = /name=['"]hq['"][^>]*value=['"]([^'"]+)['"]|value=['"]([^'"]+)['"][^>]*name=['"]hq['"]/i;
const ACTION_RE = /action=['"](https?:\/\/[^'"]+)['"]/i;
const XXC_RE =
  /<a[^>]+id=["']xxc["'][^>]+href=["'](https?:\/\/[^"']+)["']|href=["'](https?:\/\/[^"']+)["'][^>]+id=["']xxc["']/i;

const post = (url: string, body: Record<string, string>) =>
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  }).then((r) => r.text());

const ll = (html: string): string | null => LL_RE.exec(html)?.[1] ?? null;
const hqVal = (html: string): string | null => {
  const m = HQ_RE.exec(html);
  return m?.[1] ?? m?.[2] ?? null;
};
const xxc = (html: string): string | null => {
  const m = XXC_RE.exec(html);
  return m?.[1] ?? m?.[2] ?? null;
};

function blockHqAutoSubmit(): () => void {
  const proto = HTMLFormElement.prototype;
  const native = proto.submit;
  proto.submit = function (this: HTMLFormElement) {
    if (this.querySelector('input[name="hq"]')) return;
    return native.call(this);
  };
  return () => {
    proto.submit = native;
  };
}

async function chainArticle(url: string, hqToken?: string): Promise<string | null> {
  const html = hqToken
    ? await post(url, { hq: hqToken })
    : await fetch(url, { credentials: 'include' }).then((r) => r.text());
  const hw = ll(html);
  if (!hw) return null;
  return xxc(await post(url, { hw }));
}

async function chainHome(hw: string): Promise<string | null> {
  const html = await post(`${location.origin}/`, { hw });
  const article = ACTION_RE.exec(html)?.[1];
  const token = hqVal(html);
  return article && token ? chainArticle(article, token) : null;
}

async function bypassHt(): Promise<string | null> {
  const fromDom = document.querySelector<HTMLInputElement>('input[name="hq"]')?.value?.trim();
  const token =
    fromDom ||
    hqVal(document.documentElement.innerHTML) ||
    hqVal(await fetch(location.href, { credentials: 'include' }).then((r) => r.text()));
  if (!token) return null;
  const hw = ll(await post(`${location.origin}/`, { hq: token })) ?? token;
  return chainHome(hw);
}

function waitLl(): Promise<string | null> {
  const found = ll(document.documentElement.innerHTML);
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => {
      const hw = ll(document.documentElement.innerHTML);
      if (!hw) return;
      mo.disconnect();
      resolve(hw);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      mo.disconnect();
      resolve(null);
    }, 8000);
  });
}

async function run(): Promise<void> {
  const unblock = new URLSearchParams(location.search).has('ht') ? blockHqAutoSubmit() : null;
  const ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: { lead: 'Unlocking your link.', detail: "You don't need to tap anything on the page." },
    status: 'Getting things ready…',
  });
  try {
    const isHome = (location.pathname.replace(/\/+$/, '') || '/') === '/';
    const dest = new URLSearchParams(location.search).has('ht')
      ? await bypassHt()
      : await waitLl().then((hw) =>
          hw ? (isHome ? chainHome(hw) : chainArticle(location.href)) : null,
        );
    if (dest) {
      ui.setStatus('Redirecting now…');
      location.replace(dest);
      return;
    }
  } catch {
  } finally {
    unblock?.();
  }
  ui.remove();
}

export function initLlSafelinkHqChain(): void {
  if (!isAllowedHost(HOSTS)) return;
  if (new URLSearchParams(location.search).has('ht')) void run();
  else whenDomParsed(() => void run());
}
