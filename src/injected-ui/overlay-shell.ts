import { pageUiColors, pageUiRadius, PAGE_UI_FONT } from './tokens';

export function overlayRootCss(id: string, layout: 'center' | 'top'): string {
  const c = pageUiColors;
  const align = layout === 'top' ? 'flex-start' : 'center';
  const padding = layout === 'top' ? '16px 20px 0' : '20px';
  return `#${id}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:${align};justify-content:center;padding:${padding};box-sizing:border-box;background:${c.backdrop};backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:${PAGE_UI_FONT};color:${c.textSecondary};pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:default;overscroll-behavior:contain;touch-action:none}`;
}

export function overlayCardCss(id: string): string {
  const c = pageUiColors;
  return `#${id} .sw-card{max-width:440px;width:100%;border-radius:${pageUiRadius.card};padding:clamp(22px,4vw,28px);background:${c.cardGradient};border:1px solid ${c.cardBorder};box-shadow:${c.cardShadow};pointer-events:none}#${id} .sw-brand{font-size:clamp(1rem,2.5vw,1.25rem);font-weight:700;letter-spacing:-.02em;color:${c.accent};margin-bottom:8px}#${id} .sw-title{margin:0 0 12px;font-size:clamp(1.1rem,2.5vw,1.2rem);font-weight:700;color:#fff;letter-spacing:-.02em;line-height:1.25}#${id} .sw-note{font-size:.875rem;line-height:1.55;color:${c.textDetail};margin-bottom:14px}#${id} .sw-note strong{color:${c.textPrimary};font-weight:600}#${id} .sw-description{font-size:.875rem;line-height:1.55;color:${c.textDetail};margin-bottom:14px}`;
}

export function overlayStatusCss(id: string): string {
  const c = pageUiColors;
  return `#${id} .sw-status{font-size:.9rem;color:${c.textPrimary};min-height:1.4em;margin-bottom:10px}#${id} .sw-status-row{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(15,23,42,.4);border-left:3px solid ${c.accentSoft};border-radius:6px;font-size:.875rem;color:${c.textDetail}}#${id} .sw-status-row.ok{border-left-color:#34d399;color:#a7f3d0}#${id} .sw-status-row.err{border-left-color:${c.errorStrong};color:#fecaca}#${id} .sw-spinner{flex:none;width:12px;height:12px;border:2px solid rgba(96,165,250,.3);border-top-color:${c.accentSoft};border-radius:50%;animation:sw-spin .8s linear infinite}#${id} .sw-status-row.ok .sw-spinner,#${id} .sw-status-row.err .sw-spinner{display:none}@keyframes sw-spin{to{transform:rotate(360deg)}}`;
}

export function overlayCountdownCss(id: string): string {
  const c = pageUiColors;
  return `#${id} .sw-count{font-size:2.5rem;font-weight:700;font-variant-numeric:tabular-nums;color:${c.textPrimary};text-align:center;margin:6px 0 4px}#${id} .sw-count-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .sw-count-hint{font-size:.78rem;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .sw-err{font-size:.85rem;color:${c.error};margin-top:10px;line-height:1.45}`;
}

export function overlayFileCss(id: string): string {
  const c = pageUiColors;
  return `#${id} .sw-file{margin:0 0 14px;padding:10px 12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:8px;font-size:.875rem;color:${c.textDetail};word-break:break-all}#${id} .sw-file b{color:#fff;font-weight:600}#${id} .sw-file span{color:${c.textMuted};margin-left:8px;font-weight:500}`;
}

export function overlayBadgeCss(id: string): string {
  const c = pageUiColors;
  return `#${id} .sw-badge{display:inline-block;margin:0 0 10px;padding:4px 10px;background:${c.badgeBg};color:${c.accentSoft};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;border:1px solid ${c.badgeBorder}}`;
}

export function mountOverlayRoot(id: string, css: string): HTMLElement {
  const root = document.createElement('div');
  root.id = id;
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
  return root;
}

export function mountOverlayStyles(root: HTMLElement, id: string, css: string): void {
  root.id = id;
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}

const BLOCKED_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'wheel',
  'keydown',
] as const;

export function blockOverlayEvents(root: HTMLElement): void {
  for (const type of BLOCKED_EVENTS) {
    root.addEventListener(
      type,
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
