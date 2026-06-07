export const PAGE_UI_FONT =
  'system-ui,-apple-system,Segoe UI,Roboto,Poppins,sans-serif';

export const pageUiColors = {
  textPrimary: '#f1f5f9',
  textSecondary: '#f8fafc',
  textMuted: '#94a3b8',
  textDetail: '#cbd5e1',
  accent: '#38bdf8',
  accentSoft: '#60a5fa',
  accentDeep: '#2563eb',
  error: '#fca5a5',
  errorStrong: '#f87171',
  backdrop: 'rgba(15,23,42,.94)',
  cardGradient: 'linear-gradient(145deg,#1e293b 0%,#0f172a 100%)',
  cardGradientAlt: 'linear-gradient(160deg,#1a1d29 0%,#252938 100%)',
  cardBorder: 'rgba(148,163,184,.25)',
  cardShadow: '0 25px 50px -12px rgba(0,0,0,.5)',
  cardShadowInset: '0 8px 32px rgba(0,0,0,.24),0 0 0 1px rgba(0,0,0,.2)',
  badgeBg: 'rgba(59,130,246,.18)',
  badgeBorder: 'rgba(59,130,246,.35)',
  btnGradient: 'linear-gradient(180deg,#3b82f6,#2563eb)',
  btnShadow: '0 4px 14px rgba(59,130,246,.4)',
} as const;

export const pageUiRadius = {
  card: '16px',
  cardSm: 'clamp(0.5rem,2vw,0.75rem)',
  badge: '0.375rem',
  btn: '0.5rem',
} as const;
