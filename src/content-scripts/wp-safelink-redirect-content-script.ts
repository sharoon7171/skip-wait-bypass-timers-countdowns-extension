import { isAllowedHost } from '../utils/domain-check';

const HOSTS: readonly string[] = [
  'demo-safelink.themeson.com',
  'dev-safelink.themeson.com',
  'questloops.com',
  'stbemuiptvcodes.com',
];
const OVERLAY_ID = 'skip-wait-wp-safelink-overlay';
const SAFELINK_RE = /https?:\/\/[^"'\s]+safelink_redirect=[A-Za-z0-9+/=]+/;

const OVERLAY_CSS = `#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 0;box-sizing:border-box;background:rgba(15,23,42,.92);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc}#${OVERLAY_ID} .sw-card{max-width:420px;width:100%;border-radius:16px;padding:28px 24px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5);pointer-events:none}#${OVERLAY_ID} .sw-brand{font-size:1.35rem;font-weight:700;letter-spacing:-.02em;color:#38bdf8;margin-bottom:8px}#${OVERLAY_ID} .sw-note{font-size:.875rem;line-height:1.55;color:#cbd5e1}#${OVERLAY_ID} .sw-note strong{color:#e2e8f0;font-weight:600}`;

function showRedirectOverlay(): void {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.innerHTML =
    `<style>${OVERLAY_CSS}</style>` +
    '<div class="sw-card">' +
    '<div class="sw-brand">Skip Wait</div>' +
    '<div class="sw-note"><strong>Destination found — redirecting now.</strong></div>' +
    '</div>';
  document.documentElement.appendChild(root);
}

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
        showRedirectOverlay();
        window.location.replace(url);
        return;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
