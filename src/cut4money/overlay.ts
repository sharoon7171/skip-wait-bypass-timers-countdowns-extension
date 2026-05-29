const OVERLAY_ID = 'skip-wait-cut4money-overlay';
const HTML_ACTIVE_CLASS = 'sw-cut4money-active';
const OVERLAY_SESSION_KEY = 'sw-cut4money-overlay';

const BLOCKED_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'touchmove',
  'wheel',
  'keydown',
  'keyup',
  'keypress',
  'contextmenu',
  'dblclick',
  'auxclick',
  'focusin',
  'submit',
] as const;

const PAGE_HIDE_STYLE = `
html.${HTML_ACTIVE_CLASS} body {
  overflow: hidden !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
html.${HTML_ACTIVE_CLASS} body > *:not(#${OVERLAY_ID}) {
  visibility: hidden !important;
  pointer-events: none !important;
}
#${OVERLAY_ID} {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  isolation: isolate !important;
}
`;

export type OverlayCopy = { title: string; detail: string };

export type Cut4MoneyOverlay = {
  setPhase: (title: string, detail: string) => void;
  setDetail: (detail: string) => void;
  startCountdown: (seconds: number, finishingLabel?: string) => Promise<void>;
  setError: (message: string | null) => void;
};

let keepOnTopObserver: MutationObserver | null = null;
let countdownTickId = 0;

function blockEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function ensurePageHidden(): void {
  document.documentElement.classList.add(HTML_ACTIVE_CLASS);
  let style = document.getElementById(`${OVERLAY_ID}-hide`) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = `${OVERLAY_ID}-hide`;
    style.textContent = PAGE_HIDE_STYLE;
    document.documentElement.appendChild(style);
  }
}

function watchOverlayOnTop(root: HTMLElement): void {
  keepOnTopObserver?.disconnect();
  keepOnTopObserver = new MutationObserver(() => {
    if (!root.isConnected) return;
    const parent = root.parentElement ?? document.documentElement;
    if (parent.lastElementChild !== root) parent.appendChild(root);
  });
  keepOnTopObserver.observe(document.documentElement, { childList: true, subtree: true });
}

export function readOverlaySession(): OverlayCopy | null {
  try {
    const raw = sessionStorage.getItem(OVERLAY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OverlayCopy>;
    if (typeof parsed.title !== 'string' || typeof parsed.detail !== 'string') return null;
    return { title: parsed.title, detail: parsed.detail };
  } catch {
    return null;
  }
}

export function persistOverlaySession(copy: OverlayCopy): void {
  try {
    sessionStorage.setItem(OVERLAY_SESSION_KEY, JSON.stringify(copy));
  } catch {}
}

export function clearOverlaySession(): void {
  try {
    sessionStorage.removeItem(OVERLAY_SESSION_KEY);
  } catch {}
}

export function restoreOverlayFromSession(): Cut4MoneyOverlay | null {
  const copy = readOverlaySession();
  if (!copy) return null;
  const ui = mountCut4MoneyOverlay();
  ui.setPhase(copy.title, copy.detail);
  return ui;
}

export function mountCut4MoneyOverlay(): Cut4MoneyOverlay {
  ensurePageHidden();

  let root = document.getElementById(OVERLAY_ID) as HTMLElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = OVERLAY_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML =
      '<div class="sw-backdrop" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.94);font-family:system-ui,-apple-system,sans-serif;color:#f8fafc;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:none;overscroll-behavior:contain;cursor:default;-webkit-tap-highlight-color:transparent">' +
      '<div class="sw-card" style="min-width:280px;max-width:420px;padding:28px 32px;border-radius:16px;background:#1e293b;border:1px solid rgba(148,163,184,.25);text-align:center;pointer-events:none;box-shadow:0 25px 50px -12px rgba(0,0,0,.45)">' +
      '<div class="sw-brand" style="font-size:.7rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px">Skip Wait</div>' +
      '<div class="sw-phase" style="font-size:1.125rem;font-weight:600;color:#f1f5f9;margin-bottom:6px;line-height:1.35"></div>' +
      '<div class="sw-detail" style="font-size:.875rem;color:#94a3b8;line-height:1.5;min-height:1.25rem"></div>' +
      '<div class="sw-countdown" style="display:none;font-size:3rem;font-weight:700;line-height:1;color:#38bdf8;font-variant-numeric:tabular-nums;margin:12px 0 4px"></div>' +
      '<div class="sw-countdown-label" style="display:none;font-size:.8rem;color:#64748b;margin-bottom:4px">seconds remaining</div>' +
      '<div class="sw-err" style="display:none;margin-top:14px;font-size:.85rem;color:#fca5a5;line-height:1.45"></div>' +
      '</div></div>';
    for (const type of BLOCKED_EVENTS) {
      root.addEventListener(type, blockEvent, true);
    }
    document.documentElement.appendChild(root);
    watchOverlayOnTop(root);
  } else {
    ensurePageHidden();
    watchOverlayOnTop(root);
  }

  const phase = root.querySelector<HTMLElement>('.sw-phase')!;
  const detail = root.querySelector<HTMLElement>('.sw-detail')!;
  const countdown = root.querySelector<HTMLElement>('.sw-countdown')!;
  const countdownLabel = root.querySelector<HTMLElement>('.sw-countdown-label')!;
  const err = root.querySelector<HTMLElement>('.sw-err')!;

  const stopCountdown = (): void => {
    if (countdownTickId) {
      clearInterval(countdownTickId);
      countdownTickId = 0;
    }
    countdown.style.display = 'none';
    countdownLabel.style.display = 'none';
  };

  const api: Cut4MoneyOverlay = {
    setPhase(title: string, detailText: string) {
      stopCountdown();
      phase.textContent = title;
      detail.textContent = detailText;
      err.style.display = 'none';
      persistOverlaySession({ title, detail: detailText });
    },
    setDetail(detailText: string) {
      detail.textContent = detailText;
      persistOverlaySession({ title: phase.textContent ?? '', detail: detailText });
    },
    startCountdown(seconds: number, finishingLabel = 'Fetching your link…') {
      stopCountdown();
      let left = Math.max(0, Math.ceil(seconds));
      countdown.style.display = 'block';
      countdownLabel.style.display = 'block';
      countdownLabel.textContent = 'seconds remaining';
      const paint = (): void => {
        countdown.textContent = String(left);
      };
      paint();
      return new Promise<void>((resolve) => {
        const done = (): void => {
          if (countdownTickId) {
            clearInterval(countdownTickId);
            countdownTickId = 0;
          }
          countdown.textContent = '0';
          countdownLabel.textContent = finishingLabel;
          window.setTimeout(resolve, 1000);
        };
        if (left <= 0) {
          done();
          return;
        }
        countdownTickId = window.setInterval(() => {
          left -= 1;
          paint();
          if (left <= 0) done();
        }, 1000);
      });
    },
    setError(message: string | null) {
      stopCountdown();
      err.textContent = message ?? '';
      err.style.display = message ? 'block' : 'none';
    },
  };

  return api;
}
