import { isShortxTokenUrl } from './hosts';

export type ShortxFetchResult =
  | { ok: true; tokenUrl: string; adTime: number }
  | { ok: false; error: string };

export const SHORTX_FETCH_CHAIN = 'SHORTX_FETCH_CHAIN' as const;
export const SHORTX_CHECK_UNLOCK = 'SHORTX_CHECK_UNLOCK' as const;
export const SHORTX_RESULT_PREFIX = 'sw-shortx-result-';
export const SHORTX_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function shortxResultKey(startUrl: string): string {
  return `${SHORTX_RESULT_PREFIX}${startUrl.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

type WpPayload = { linkr?: string };

function pick(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

function decodePayload(raw: string): WpPayload | null {
  try {
    return JSON.parse(atob(raw)) as WpPayload;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string, form?: Record<string, string>): Promise<string> {
  const init: RequestInit = {
    credentials: 'include',
    redirect: 'follow',
    headers: { Accept: 'text/html,*/*', 'User-Agent': SHORTX_USER_AGENT },
  };
  if (form) {
    init.method = 'POST';
    init.headers = { ...init.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
    init.body = new URLSearchParams(form);
  }
  return (await fetch(url, init)).text();
}

async function fetchAdToken(adUrl: string): Promise<string | null> {
  const resp = await fetch(adUrl, {
    credentials: 'include',
    redirect: 'follow',
    headers: { Accept: 'text/html,*/*', 'User-Agent': SHORTX_USER_AGENT },
  });
  const tokenUrl = resp.url.split('#')[0] ?? '';
  return isShortxTokenUrl(tokenUrl) ? tokenUrl : null;
}

export async function runShortxFetchChain(startUrl: string): Promise<ShortxFetchResult> {
  try {
    let h = await fetchHtml(startUrl);
    const go = pick(h, /name="go" value="([^"]+)"/);
    const act1 = pick(h, /action="([^"]+)"/);
    if (!go || !act1) return { ok: false, error: 'landing form missing' };

    h = await fetchHtml(act1, { go });
    const act2 = pick(h, /action="([^"]+)"/);
    const nw = pick(h, /name="newwpsafelink" value="([^"]+)"/);
    if (!act2 || !nw) return { ok: false, error: 'hop1 payload missing' };

    const p1 = decodePayload(nw);
    if (!p1?.linkr) return { ok: false, error: 'hop1 linkr missing' };

    h = await fetchHtml(act2, { humanverification: '1', newwpsafelink: nw });

    let h2 = await fetchHtml(p1.linkr);
    const actGo = pick(h2, /action="([^"]+)"/);
    const go2 = pick(h2, /name="go" value="([^"]+)"/);
    if (!actGo || !go2) return { ok: false, error: 'hop2 landing missing' };
    h2 = await fetchHtml(actGo, { go: go2 });

    const acth = pick(h2, /action="([^"]+)"/);
    const nwh = pick(h2, /name="newwpsafelink" value="([^"]+)"/);
    if (!acth || !nwh) return { ok: false, error: 'hop2 form missing' };

    h2 = await fetchHtml(acth, { humanverification: '1', newwpsafelink: nwh });

    const adUrl = pick(h2, /window\.open\('([^']+)'/);
    if (!adUrl) return { ok: false, error: 'ad redirect missing' };

    const adTime = Date.now();
    const tokenUrl = await fetchAdToken(adUrl);
    if (!tokenUrl) return { ok: false, error: 'ad token redirect missing' };

    const act3 = pick(h2, /<form id="wpsafelink-landing"[^>]*action="([^"]+)"/);
    const nw3 = pick(h2, /name="newwpsafelink"\s+value="([^"]+)"/s);
    if (act3 && nw3) await fetchHtml(act3, { newwpsafelink: nw3 });

    return { ok: true, tokenUrl, adTime };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'fetch chain failed' };
  }
}
