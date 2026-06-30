const FULL_PAGE_FONT =
  '"Segoe UI Variable","Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,Roboto,"Helvetica Neue",Arial,sans-serif';

const colors = {
  textPrimary: '#f1f5f9',
  textSecondary: '#f8fafc',
  textMuted: '#94a3b8',
  textDetail: '#cbd5e1',
  accent: '#38bdf8',
  accentSoft: '#60a5fa',
  error: '#fca5a5',
  backdrop: 'rgba(15,23,42,.94)',
  cardGradient: 'linear-gradient(145deg,#1e293b 0%,#0f172a 100%)',
  cardBorder: 'rgba(148,163,184,.25)',
  cardShadow: '0 25px 50px -12px rgba(0,0,0,.5)',
} as const;

const BLOCKED_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'wheel',
  'keydown',
] as const;

export type FullPageOverlayOptions = {
  id: string;
  brand?: string;
  noteHtml: string;
  status?: string;
  countdownLabel?: string;
  countdownHint?: string;
};

export type FullPageOverlay = {
  turnstileMount: HTMLElement;
  setStatus: (text: string) => void;
  setNote: (html: string) => void;
  setError: (text: string | null) => void;
  startCountdown: (endTs: number) => void;
  stopCountdown: () => void;
  hideCountdown: () => void;
  remove: () => void;
};

function pageLockCss(overlayId: string, activeClass: string): string {
  return `html.${activeClass} body{overflow:hidden!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}html.${activeClass} body>*:not(#${overlayId}){visibility:hidden!important;pointer-events:none!important}`;
}

function overlayRootCss(id: string): string {
  const c = colors;
  return `#${id}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:${c.backdrop};backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:${FULL_PAGE_FONT};font-size:16px;line-height:1.5;color:${c.textSecondary};pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:default;overscroll-behavior:contain;touch-action:none}`;
}

function overlayCardCss(id: string): string {
  const c = colors;
  return `#${id} .sw-card{max-width:440px;width:100%;border-radius:16px;padding:clamp(22px,4vw,28px);background:${c.cardGradient};border:1px solid ${c.cardBorder};box-shadow:${c.cardShadow};pointer-events:none;font-family:${FULL_PAGE_FONT}}#${id} .sw-brand{font-family:${FULL_PAGE_FONT};font-size:clamp(1rem,2.5vw,1.25rem);font-weight:700;letter-spacing:-.02em;color:${c.accent};margin-bottom:8px}#${id} .sw-note{font-family:${FULL_PAGE_FONT};font-size:.875rem;line-height:1.55;color:${c.textDetail};margin-bottom:14px}#${id} .sw-note strong{color:${c.textPrimary};font-weight:600}#${id} .sw-status{font-family:${FULL_PAGE_FONT};font-size:.9rem;color:${c.textPrimary};min-height:1.4em;margin-bottom:10px}`;
}

function overlayCountdownCss(id: string): string {
  const c = colors;
  return `#${id} .sw-count{font-family:${FULL_PAGE_FONT};font-size:2.5rem;font-weight:700;font-variant-numeric:tabular-nums;color:${c.textPrimary};text-align:center;margin:6px 0 4px}#${id} .sw-count-label{font-family:${FULL_PAGE_FONT};font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .sw-count-hint{font-family:${FULL_PAGE_FONT};font-size:.78rem;color:${c.textMuted};text-align:center;margin-top:4px}#${id} .sw-err{font-family:${FULL_PAGE_FONT};font-size:.85rem;color:${c.error};margin-top:10px;line-height:1.45}`;
}

function turnstileMountCss(id: string): string {
  return `#${id} .sw-turnstile{display:flex;align-items:center;justify-content:center;min-height:72px;margin-top:16px;pointer-events:auto!important;isolation:isolate}#${id} .sw-turnstile iframe,#${id} .sw-turnstile input{pointer-events:auto!important}`;
}

function mountOverlayRoot(id: string, css: string): HTMLElement {
  const root = document.createElement('div');
  root.id = id;
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
  return root;
}

function isInteractiveTarget(root: HTMLElement, event: Event): boolean {
  const mount = root.querySelector('.sw-turnstile');
  if (!mount) return false;
  return event.composedPath().includes(mount);
}

function blockOverlayEvents(root: HTMLElement): void {
  for (const type of BLOCKED_EVENTS) {
    root.addEventListener(
      type,
      (event) => {
        if (isInteractiveTarget(root, event)) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }
}

export function createFullPageOverlay(options: FullPageOverlayOptions): FullPageOverlay {
  const {
    id,
    brand = 'Skip Wait',
    noteHtml,
    status = 'Getting things ready…',
    countdownLabel = 'Your link opens in',
    countdownHint,
  } = options;

  const activeClass = `${id}-active`;
  const root = mountOverlayRoot(
    id,
    pageLockCss(id, activeClass) +
      overlayRootCss(id) +
      overlayCardCss(id) +
      overlayCountdownCss(id) +
      turnstileMountCss(id),
  );

  document.documentElement.classList.add(activeClass);
  blockOverlayEvents(root);

  const card = document.createElement('div');
  card.className = 'sw-card';
  const turnstileMount = document.createElement('div');
  turnstileMount.className = 'sw-turnstile';
  turnstileMount.id = `${id}-turnstile`;
  card.innerHTML =
    `<div class="sw-brand">${brand}</div>` +
    `<div class="sw-note">${noteHtml}</div>` +
    `<div class="sw-status">${status}</div>` +
    '<div class="sw-count" style="display:none"></div>' +
    `<div class="sw-count-label" style="display:none">${countdownLabel}</div>` +
    (countdownHint ? `<div class="sw-count-hint" style="display:none">${countdownHint}</div>` : '') +
    '<div class="sw-err" style="display:none"></div>';
  card.appendChild(turnstileMount);
  root.appendChild(card);
  document.documentElement.appendChild(root);

  const note = root.querySelector<HTMLElement>('.sw-note')!;
  const statusEl = root.querySelector<HTMLElement>('.sw-status')!;
  const count = root.querySelector<HTMLElement>('.sw-count')!;
  const countLabel = root.querySelector<HTMLElement>('.sw-count-label')!;
  const countHint = root.querySelector<HTMLElement>('.sw-count-hint');
  const err = root.querySelector<HTMLElement>('.sw-err')!;
  let rafId = 0;

  const setCountdownVisible = (visible: boolean): void => {
    count.style.display = visible ? 'block' : 'none';
    countLabel.style.display = visible ? 'block' : 'none';
    if (countHint) countHint.style.display = visible ? 'block' : 'none';
  };

  const stopCountdown = (hide: boolean): void => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (hide) setCountdownVisible(false);
  };

  return {
    turnstileMount,
    setStatus(text) {
      statusEl.textContent = text;
    },
    setNote(html) {
      note.innerHTML = html;
    },
    setError(text) {
      err.textContent = text ?? '';
      err.style.display = text ? 'block' : 'none';
    },
    startCountdown(endTs) {
      setCountdownVisible(true);
      const tick = (): void => {
        const left = endTs - Date.now();
        count.textContent = `${(Math.max(0, left) / 1000).toFixed(2)} s`;
        if (left <= 0) {
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    },
    stopCountdown: () => stopCountdown(false),
    hideCountdown: () => stopCountdown(true),
    remove() {
      stopCountdown(true);
      root.remove();
      document.documentElement.classList.remove(activeClass);
    },
  };
}
