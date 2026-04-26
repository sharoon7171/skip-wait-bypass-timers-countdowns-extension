import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'shrinkme-themezon-mrproblogger';
const THEMEZON_LINK = 'https://themezon.net/link.php?link=';
const MRPRO_ORIGIN = 'https://en.mrproblogger.com/';

const isHttpUrl = (s: string): boolean =>
  typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://'));

function redirectWhen(
  check: () => string | null,
  opts?: { attributes?: boolean; attributeFilter?: string[] }
): void {
  const url = check();
  if (url) {
    window.location.replace(url);
    return;
  }
  const observer = new MutationObserver(() => {
    const u = check();
    if (u) {
      observer.disconnect();
      window.location.replace(u);
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    ...(opts?.attributes && { attributes: true, attributeFilter: opts.attributeFilter ?? [] }),
  });
  document.addEventListener('DOMContentLoaded', () => {
    const u = check();
    if (u) window.location.replace(u);
  });
}

export function initShrinkmeThemezonMrproblogger(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const host = new URL(window.location.href).hostname.toLowerCase();

  if (host === 'shrinkme.click') {
    const code = window.location.pathname.replace(/^\/+/, '').trim();
    if (code) window.location.replace(THEMEZON_LINK + encodeURIComponent(code));
    return;
  }

  if (host === 'themezon.net') {
    redirectWhen(() => {
      const code = document.querySelector<HTMLInputElement>('input[name=newwpsafelink]')?.value?.trim();
      return code ? MRPRO_ORIGIN + encodeURIComponent(code) : null;
    });
    return;
  }

  if (host === 'en.mrproblogger.com') {
    redirectWhen(
      () => {
        const href = document.querySelector<HTMLAnchorElement>('a.get-link')?.href?.trim();
        return href && isHttpUrl(href) ? href : null;
      },
      { attributes: true, attributeFilter: ['href'] }
    );
  }
}
