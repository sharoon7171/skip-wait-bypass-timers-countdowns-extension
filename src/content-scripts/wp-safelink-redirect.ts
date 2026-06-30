import { isAllowedHost } from '../utils/domain-check';
import { showMessageOverlay } from '../injected-ui/message-overlay';

const HOSTS = [
  'demo-safelink.themeson.com',
  'dev-safelink.themeson.com',
  'questloops.com',
  'stbemuiptvcodes.com',
] as const;
const OVERLAY_ID = 'skip-wait-wp-safelink-overlay';
const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;

function urlFromNode(node: Node): string | null {
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  if (el.tagName === 'SCRIPT') {
    const m = (el as HTMLScriptElement).textContent?.match(SAFELINK_RE);
    if (m?.[0]) return m[0];
  } else if (el.tagName === 'A') {
    const href = (el as HTMLAnchorElement).href;
    if (href && href.includes('safelink_redirect=') && /^https?:\/\//.test(href)) return href;
  }
  return null;
}

export function initWpSafelinkRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        const url = urlFromNode(n);
        if (!url) continue;
        mo.disconnect();
        showMessageOverlay({
          id: OVERLAY_ID,
          noteHtml: '<strong>Destination found — redirecting now.</strong>',
        });
        window.location.replace(url);
        return;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
