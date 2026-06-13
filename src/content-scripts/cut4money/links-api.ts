import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../arolinks/page';
import { shortenerUrl } from './hosts';

const CONTINUE_RE = /id=["']form-continue["']|#form-continue/i;
const UNLOCK_RE =
  /\/links\/go|id=["']go-link["']|id=["']link-view["']|a\.get-link/i;

function pageHtml(): string {
  return document.documentElement?.innerHTML ?? '';
}

function pick(html: string, re: RegExp): string | null {
  return html.match(re)?.[1] ?? null;
}

export function isShortenerContinuePage(html: string = pageHtml()): boolean {
  return CONTINUE_RE.test(html);
}

export function isV2linksInterstitial(html: string = pageHtml()): boolean {
  if (/#wolfexe-time|id=["']go_d["']|#nextBtn|moobiedat-container/i.test(html)) return false;
  if (CONTINUE_RE.test(html)) return false;
  if (html.length < 2500) return false;
  return UNLOCK_RE.test(html);
}

function counterSec(html: string, fallbackSec = 5): number {
  const m = html.match(/"counter_value"\s*:\s*(\d+)/);
  return m?.[1] ? Math.max(0, parseInt(m[1], 10)) : fallbackSec;
}

async function fetchShortenerHtml(
  url: string,
  form?: Record<string, string>,
): Promise<string> {
  const init: RequestInit = {
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
    headers: { Accept: 'text/html' },
  };
  if (form) {
    init.method = 'POST';
    init.headers = {
      ...(init.headers as Record<string, string>),
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    init.body = new URLSearchParams(form);
  }
  return (await fetch(url, init)).text();
}

function continueFormFields(html: string): Record<string, string> | null {
  const csrf = pick(html, /name="_csrfToken"[^>]*value="([^"]+)"/);
  const page = pick(html, /name="page" value="([^"]+)"/);
  if (!csrf || !page) return null;
  return {
    _method: 'POST',
    _csrfToken: csrf,
    action: 'continue',
    page,
    '_Token[fields]': pick(html, /name="_Token\[fields\]"[^>]*value="([^"]+)"/) ?? '',
    '_Token[unlocked]': pick(html, /name="_Token\[unlocked\]"[^>]*value="([^"]+)"/) ?? '',
  };
}

async function resolveUnlockHtml(pageUrl: string): Promise<string> {
  let html = pageHtml();
  let guard = 0;
  while (CONTINUE_RE.test(html) && guard++ < 12) {
    const fields = continueFormFields(html);
    if (!fields) break;
    html = await fetchShortenerHtml(pageUrl, fields);
  }
  return html;
}

export async function fetchShortenerFirstHop(
  alias: string,
  host: string,
): Promise<string | null> {
  try {
    const page = shortenerUrl(alias, host);
    const resp = await fetch(page, {
      redirect: 'manual',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    });
    const loc = resp.headers.get('location');
    if (!loc) return null;
    return new URL(loc, page).href;
  } catch {
    return null;
  }
}

async function postLinksGoFromHtml(html: string, pageUrl: string): Promise<string | null> {
  const form = linksGoFormFromHtml(html, pageUrl);
  if (!form) return null;
  return postLinksGo(form, pageUrl);
}

export async function finishV2linksInterstitial(
  pageUrl: string = location.href,
  wait?: (seconds: number) => Promise<void>,
): Promise<string | null> {
  revealTimerLinks();

  const html = CONTINUE_RE.test(pageHtml()) ? await resolveUnlockHtml(pageUrl) : pageHtml();
  const immediate = await postLinksGoFromHtml(html, pageUrl);
  if (immediate) return immediate;

  const sec = counterSec(html);
  if (sec <= 0) return null;

  const countdown = wait?.(sec);
  const endAt = Date.now() + (sec + 2) * 1000;
  while (Date.now() < endAt) {
    const url = await postLinksGoFromHtml(html, pageUrl);
    if (url) {
      if (countdown) await countdown;
      return url;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (countdown) await countdown;
  return postLinksGoFromHtml(html, pageUrl);
}
