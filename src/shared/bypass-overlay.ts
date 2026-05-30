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

export type BypassOverlayCopy = { title: string; detail: string };

export type BypassOverlay = {
  setPhase: (title: string, detail: string) => void;
  setDetail: (detail: string) => void;
  startCountdown: (seconds: number, finishingLabel?: string) => Promise<void>;
  setError: (message: string | null) => void;
};

export type BypassOverlayConfig = {
  id: string;
  activeClass: string;
  sessionKey: string;
  brand: string;
  countdownLabel?: string;
  countdownDoneMs?: number;
};

export type BypassOverlayApi = {
  readOverlaySession: () => BypassOverlayCopy | null;
  persistOverlaySession: (copy: BypassOverlayCopy) => void;
  clearOverlaySession: () => void;
  restoreOverlayFromSession: () => BypassOverlay | null;
  mountOverlay: () => BypassOverlay;
};

export function createBypassOverlay(config: BypassOverlayConfig): BypassOverlayApi {
  const {
    id: overlayId,
    activeClass: htmlActiveClass,
    sessionKey: overlaySessionKey,
    brand,
    countdownLabel = 'seconds remaining',
    countdownDoneMs = 400,
  } = config;

  const pageHideStyle = `
html.${htmlActiveClass} body {
  overflow: hidden !important;
  touch-action: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}
html.${htmlActiveClass} body > *:not(#${overlayId}) {
  visibility: hidden !important;
  pointer-events: none !important;
}
#${overlayId} {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  isolation: isolate !important;
}
`;

  let keepOnTopObserver: MutationObserver | null = null;
  let countdownTickId = 0;

  function blockEvent(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function ensurePageHidden(): void {
    document.documentElement.classList.add(htmlActiveClass);
    let style = document.getElementById(`${overlayId}-hide`) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = `${overlayId}-hide`;
      style.textContent = pageHideStyle;
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

  function readOverlaySession(): BypassOverlayCopy | null {
    try {
      const raw = sessionStorage.getItem(overlaySessionKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<BypassOverlayCopy>;
      if (typeof parsed.title !== 'string' || typeof parsed.detail !== 'string') return null;
      return { title: parsed.title, detail: parsed.detail };
    } catch {
      return null;
    }
  }

  function persistOverlaySession(copy: BypassOverlayCopy): void {
    try {
      sessionStorage.setItem(overlaySessionKey, JSON.stringify(copy));
    } catch {}
  }

  function clearOverlaySession(): void {
    try {
      sessionStorage.removeItem(overlaySessionKey);
    } catch {}
  }

  function restoreOverlayFromSession(): BypassOverlay | null {
    const copy = readOverlaySession();
    if (!copy) return null;
    const ui = mountOverlay();
    ui.setPhase(copy.title, copy.detail);
    return ui;
  }

  function mountOverlay(): BypassOverlay {
    ensurePageHidden();

    let root = document.getElementById(overlayId) as HTMLElement | null;
    if (!root) {
      root = document.createElement('div');
      root.id = overlayId;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-live', 'polite');
      root.innerHTML =
        '<div class="sw-backdrop" style="position:fixed;inset:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:clamp(16px,4vw,28px);background:rgba(15,23,42,.94);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:none;overscroll-behavior:contain;cursor:default;-webkit-tap-highlight-color:transparent">' +
        '<div class="sw-card" style="box-sizing:border-box;width:min(92vw,440px);min-width:min(300px,92vw);max-width:440px;padding:clamp(28px,5vw,36px) clamp(24px,5vw,40px);border-radius:16px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);text-align:center;pointer-events:none;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)">' +
        `<div class="sw-brand" style="font-size:clamp(1rem,2.5vw,1.2rem);font-weight:700;letter-spacing:-.02em;color:#38bdf8;margin-bottom:10px;line-height:1.3">${brand}</div>` +
        '<div class="sw-phase" style="font-size:clamp(1.2rem,3vw,1.35rem);font-weight:600;color:#f1f5f9;margin-bottom:8px;line-height:1.35"></div>' +
        '<div class="sw-detail" style="font-size:clamp(.9375rem,2.2vw,1rem);color:#cbd5e1;line-height:1.55;min-height:1.5rem"></div>' +
        '<div class="sw-countdown" style="display:none;font-size:clamp(3.25rem,10vw,4rem);font-weight:700;line-height:1;color:#38bdf8;font-variant-numeric:tabular-nums;margin:16px 0 6px"></div>' +
        `<div class="sw-countdown-label" style="display:none;font-size:.875rem;color:#94a3b8;margin-bottom:6px;line-height:1.4">${countdownLabel}</div>` +
        '<div class="sw-err" style="display:none;margin-top:16px;font-size:.9375rem;color:#fca5a5;line-height:1.45"></div>' +
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
    const countdownLabelEl = root.querySelector<HTMLElement>('.sw-countdown-label')!;
    const err = root.querySelector<HTMLElement>('.sw-err')!;

    const stopCountdown = (): void => {
      if (countdownTickId) {
        clearInterval(countdownTickId);
        countdownTickId = 0;
      }
      countdown.style.display = 'none';
      countdownLabelEl.style.display = 'none';
    };

    return {
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
        countdownLabelEl.style.display = 'block';
        countdownLabelEl.textContent = countdownLabel;
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
            countdownLabelEl.textContent = finishingLabel;
            window.setTimeout(resolve, countdownDoneMs);
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
  }

  return {
    readOverlaySession,
    persistOverlaySession,
    clearOverlaySession,
    restoreOverlayFromSession,
    mountOverlay,
  };
}
