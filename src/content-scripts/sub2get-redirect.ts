import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'sub2get-redirect';
const UNLOCK_SELECTOR = '#butunlock a';

function toAbsoluteUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s.replace(/^\//, '')}`;
}

export function initSub2getRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;

  const tryRedirect = (): boolean => {
    const href = document.querySelector(UNLOCK_SELECTOR)?.getAttribute('href')?.trim();
    if (!href) return false;
    window.location.href = toAbsoluteUrl(href);
    return true;
  };

  if (tryRedirect()) return;

  const observer = new MutationObserver(() => {
    if (tryRedirect()) observer.disconnect();
  });
  observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}
