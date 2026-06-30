import {
  blockOverlayEvents,
  mountOverlayRoot,
  overlayCardCss,
  overlayCountdownCss,
  overlayRootCss,
} from './overlay-shell';

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

function turnstileMountCss(id: string): string {
  return `#${id} .sw-turnstile{display:flex;align-items:center;justify-content:center;min-height:72px;margin-top:16px;pointer-events:auto!important;isolation:isolate}#${id} .sw-turnstile iframe,#${id} .sw-turnstile input{pointer-events:auto!important}`;
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
      overlayRootCss(id, 'center') +
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
