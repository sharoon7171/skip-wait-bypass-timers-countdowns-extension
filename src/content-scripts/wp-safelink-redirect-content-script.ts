import { isAllowedHost } from '../utils/domain-check';

const ALLOWED_HOSTS = ['demo-safelink.themeson.com', 'dev-safelink.themeson.com'];
const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;

export function getSafelinkRedirectUrl(): string | null {
  const href = document.querySelector<HTMLAnchorElement>('a[href*="safelink_redirect"]')?.href?.trim();
  if (href && /^https?:\/\//.test(href)) return href;
  for (const script of document.scripts) {
    const m = script.textContent?.match(SAFELINK_RE);
    if (m?.[0]) return m[0];
  }
  return null;
}

export function initWpSafelinkRedirect(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  const run = (): void => {
    const url = getSafelinkRedirectUrl();
    if (url) window.location.href = url;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
