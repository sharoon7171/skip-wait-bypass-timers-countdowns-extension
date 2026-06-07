import {
  linksGoFormFromHtml,
  postLinksGo,
  revealTimerLinks,
} from '../arolinks/page';
import { isLinkjustHost } from './hosts';

const UNLOCK_MARKERS =
  /#go-link|form[action*="/links/go"]|a\.get-link|counter_value|id=["']link-view["']/i;

export function isLinkjustUnlockPage(html: string = document.documentElement?.innerHTML ?? ''): boolean {
  if (!isLinkjustHost()) return false;
  return UNLOCK_MARKERS.test(html);
}

export function linkjustCounterSec(html: string = document.documentElement?.innerHTML ?? ''): number {
  const m = html.match(/"counter_value"\s*:\s*(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  const t = document.querySelector('#timer, #countdown, .timer');
  const n = parseInt(t?.textContent?.trim() ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function postLinksGoFromPage(pageUrl: string): Promise<string | null> {
  const form = linksGoFormFromHtml(document.documentElement.innerHTML, pageUrl);
  if (!form) return null;
  return postLinksGo(form, pageUrl);
}

export async function finishLinkjustUnlock(
  pageUrl: string = location.href,
  wait?: (seconds: number) => Promise<void>,
): Promise<string | null> {
  revealTimerLinks();
  const link = document.querySelector<HTMLAnchorElement>('a.get-link');
  if (link?.href && /^https?:\/\//i.test(link.href)) return link.href;

  const immediate = await postLinksGoFromPage(pageUrl);
  if (immediate) return immediate;

  const sec = linkjustCounterSec();
  if (sec > 0) {
    if (wait) await wait(sec);
    else await new Promise((r) => setTimeout(r, (sec + 1) * 1000));
  }

  revealTimerLinks();
  return postLinksGoFromPage(pageUrl);
}
