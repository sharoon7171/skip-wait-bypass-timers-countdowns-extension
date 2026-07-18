import { hostnameMatches, isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { ADFOCUS_HOSTS } from './hosts';

const CLICK_URL_RE = /var\s+click_url\s*=\s*"([^"]+)"/;

function decodeHtml(s: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

function destinationFromPage(): string | null {
  const fromJs = CLICK_URL_RE.exec(document.documentElement.innerHTML)?.[1];
  const raw =
    fromJs ??
    document.querySelector<HTMLAnchorElement>('#showSkip a.skip, #showSkip a')?.getAttribute('href');
  if (!raw) return null;
  const href = decodeHtml(raw).trim();
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    const dest = new URL(href);
    if (hostnameMatches(dest.hostname, ADFOCUS_HOSTS)) return null;
    return dest.href;
  } catch {
    return null;
  }
}

function redirect(): void {
  const dest = destinationFromPage();
  if (dest) location.replace(dest);
}

export function initAdfocusRedirect(): void {
  if (!isAllowedHost(ADFOCUS_HOSTS)) return;
  whenDomParsed(redirect);
}
