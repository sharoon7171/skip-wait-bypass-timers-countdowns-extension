export const OVERLAY_FONT =
  '"Segoe UI Variable","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,Roboto,"Helvetica Neue",Arial,sans-serif';

export const overlayColors = {
  textPrimary: '#f1f5f9',
  textSecondary: '#f8fafc',
  textMuted: '#94a3b8',
  textDetail: '#cbd5e1',
  accent: '#38bdf8',
  error: '#fca5a5',
  backdrop: 'rgba(15,23,42,.94)',
  cardGradient: 'linear-gradient(145deg,#1e293b 0%,#0f172a 100%)',
  cardBorder: 'rgba(148,163,184,.25)',
  cardShadow: '0 25px 50px -12px rgba(0,0,0,.5)',
} as const;

export const overlayClasses = {
  card: 'sw-card',
  brand: 'sw-brand',
  note: 'sw-note',
  noteLead: 'sw-note-lead',
  noteDetail: 'sw-note-detail',
  status: 'sw-status',
  count: 'sw-count',
  countLabel: 'sw-count-label',
  countHint: 'sw-count-hint',
  err: 'sw-err',
  hidden: 'sw-hidden',
  turnstile: 'sw-turnstile',
} as const;

export function overlayActiveClass(overlayId: string): string {
  return `${overlayId}-active`;
}

export function overlayPageLockCss(overlayId: string, activeClass: string): string {
  return `html.${activeClass} body{overflow:hidden!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}html.${activeClass} body>*:not(#${overlayId}){visibility:hidden!important;pointer-events:none!important}`;
}

export function overlayRootCss(id: string): string {
  const c = overlayColors;
  return `#${id}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:${c.backdrop};backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:${OVERLAY_FONT};font-size:16px;line-height:1.5;color:${c.textSecondary};pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:default;overscroll-behavior:contain;touch-action:none}`;
}

export function overlayCardCss(id: string): string {
  const c = overlayColors;
  const f = OVERLAY_FONT;
  const cl = overlayClasses;
  return `#${id} .${cl.card}{max-width:440px;width:100%;border-radius:16px;padding:clamp(22px,4vw,28px);background:${c.cardGradient};border:1px solid ${c.cardBorder};box-shadow:${c.cardShadow};pointer-events:none;font-family:${f}}#${id} .${cl.brand}{font-family:${f};font-size:clamp(1em,2.5vw,1.25em);font-weight:700;letter-spacing:-.02em;color:${c.accent};margin-bottom:8px}#${id} .${cl.note}{font-family:${f};font-size:.875em;line-height:1.55;color:${c.textDetail};margin-bottom:14px}#${id} .${cl.noteLead}{color:${c.textPrimary};font-weight:600}#${id} .${cl.status}{font-family:${f};font-size:.9em;color:${c.textPrimary};min-height:1.4em;margin-bottom:10px}#${id} .${cl.hidden}{display:none!important}`;
}

export function overlayCountdownCss(id: string): string {
  const c = overlayColors;
  const f = OVERLAY_FONT;
  const cl = overlayClasses;
  return `#${id} .${cl.count}{font-family:${f};font-size:2.5em;font-weight:700;font-variant-numeric:tabular-nums;color:${c.textPrimary};text-align:center;margin:6px 0 4px;line-height:1.15}#${id} .${cl.countLabel}{font-family:${f};font-size:.7em;text-transform:uppercase;letter-spacing:.08em;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .${cl.countHint}{font-family:${f};font-size:.78em;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .${cl.err}{font-family:${f};font-size:.85em;color:${c.error};margin-top:10px;line-height:1.45}#${id} .${cl.err}:empty{display:none}`;
}

export function overlayTurnstileMountCss(id: string): string {
  const cl = overlayClasses;
  return `#${id} .${cl.turnstile}{display:flex;align-items:center;justify-content:center;min-height:72px;margin-top:16px;pointer-events:auto!important;isolation:isolate}#${id} .${cl.turnstile} iframe,#${id} .${cl.turnstile} input{pointer-events:auto!important}`;
}

export function buildFullPageOverlayCss(id: string, activeClass: string): string {
  return (
    overlayPageLockCss(id, activeClass) +
    overlayRootCss(id) +
    overlayCardCss(id) +
    overlayCountdownCss(id) +
    overlayTurnstileMountCss(id)
  );
}
