import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['sub2get.com'] as const;
const UNLOCK_SELECTOR = '#butunlock a';

function toAbsoluteUrl(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s.replace(/^\//, '')}`;
}

export function initSub2getRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;

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
