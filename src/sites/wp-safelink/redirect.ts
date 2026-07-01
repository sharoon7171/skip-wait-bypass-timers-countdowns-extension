import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

export const WP_SAFELINK_OVERLAY_ID = 'skip-wait-wp-safelink-overlay';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

const HOSTS = [
  'demo-safelink.themeson.com',
  'dev-safelink.themeson.com',
  'stbemuiptvcodes.com',
] as const;
const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;
const WAIT_MARKERS = '#wpsafe-wait1, #wpsafelink-countdown, #wpsafe-generate, #wpsafe-link, a[href*="safelink_redirect="]';

const safelinkInText = (text: string): string | null => SAFELINK_RE.exec(text)?.[0] ?? null;

const safelinkFromHref = (href: string): string | null =>
  href.includes('safelink_redirect=') && /^https?:\/\//.test(href) ? href : null;

const safelinkFromNode = (node: Node): string | null => {
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  if (el.tagName === 'SCRIPT') return safelinkInText((el as HTMLScriptElement).textContent ?? '');
  if (el.tagName !== 'A') return null;
  return safelinkFromHref((el as HTMLAnchorElement).href);
};

const isWaitPage = (): boolean =>
  /[?&]go=/.test(location.search) || !!document.querySelector(WAIT_MARKERS);

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const findSafelinkUrl = (): string | null => {
  for (const script of document.scripts) {
    const url = safelinkInText(script.textContent ?? '');
    if (url) return url;
  }
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href*="safelink_redirect="]')) {
    const url = safelinkFromHref(a.href);
    if (url) return url;
  }
  return safelinkInText(document.documentElement.innerHTML);
};

const resolveSafelinkUrl = (url: string): string => {
  try {
    const token = new URL(url, location.origin).searchParams.get('safelink_redirect');
    if (!token) return url;
    const data = JSON.parse(atob(token)) as { safelink?: string; second_safelink_url?: string };
    const enc = data.second_safelink_url || data.safelink;
    if (!enc) return url;
    const dest = decodeURIComponent(enc);
    return /^https?:\/\//.test(dest) ? dest : url;
  } catch {
    return url;
  }
};

export const showWpSafelinkRedirectOverlay = (): void => {
  if (document.getElementById(WP_SAFELINK_OVERLAY_ID)) return;
  createFullPageOverlay({
    id: WP_SAFELINK_OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status: 'Redirecting now…',
    countdownLabel: 'Your link opens in',
  });
};

const redirectSafelink = (url: string): void => {
  showWpSafelinkRedirectOverlay();
  location.replace(resolveSafelinkUrl(url));
};

export function initWpSafelinkRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  requestVisibilitySpoof();
  if (/[?&]go=/.test(location.search)) showWpSafelinkRedirectOverlay();

  let done = false;
  let pollId = 0;

  const finish = (url: string): void => {
    if (done) return;
    done = true;
    mo.disconnect();
    if (pollId) clearInterval(pollId);
    redirectSafelink(url);
  };

  const tryFind = (): void => {
    const url = findSafelinkUrl();
    if (url) finish(url);
  };

  const mo = new MutationObserver((muts) => {
    for (const { addedNodes } of muts) {
      for (const node of addedNodes) {
        const url = safelinkFromNode(node);
        if (url) {
          finish(url);
          return;
        }
      }
    }
    tryFind();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  whenDomParsed(() => {
    if (isWaitPage()) showWpSafelinkRedirectOverlay();
    tryFind();
  });

  pollId = window.setInterval(() => {
    if (done) return;
    requestVisibilitySpoof();
    tryFind();
  }, 500);
}
