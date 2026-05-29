import { linksGoFormFromHtml, postLinksGo, revealTimerLinks } from '../shared/arolinks-page';
import { shortenerUrl } from './hosts';

function pageHtml(): string {
  return document.documentElement?.innerHTML ?? '';
}

export function isV2linksInterstitial(html: string = pageHtml()): boolean {
  if (/#wolfexe-time|id=["']go_d["']|#nextBtn|moobiedat-container/i.test(html)) return false;
  if (html.length < 2500) return false;
  return /v2links_theme|cut4money|\/links\/go|id=["']go-link["']|counter_value/i.test(html);
}

function v2linksCounterSec(html: string = pageHtml(), fallbackSec = 5): number {
  const m = html.match(/"counter_value"\s*:\s*(\d+)/);
  return m?.[1] ? Math.max(0, parseInt(m[1], 10)) : fallbackSec;
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

async function postLinksGoFromPage(pageUrl: string): Promise<string | null> {
  const form = linksGoFormFromHtml(pageHtml(), pageUrl);
  if (!form) return null;
  return postLinksGo(form, pageUrl);
}

export async function finishV2linksInterstitial(
  pageUrl: string = location.href,
  wait?: (seconds: number) => Promise<void>,
): Promise<string | null> {
  revealTimerLinks();
  const immediate = await postLinksGoFromPage(pageUrl);
  if (immediate) return immediate;

  const sec = v2linksCounterSec();
  if (sec <= 0) return null;
  if (wait) await wait(sec);
  else await new Promise((r) => setTimeout(r, (sec + 1) * 1000));
  revealTimerLinks();
  return postLinksGoFromPage(pageUrl);
}
