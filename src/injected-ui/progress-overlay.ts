import {
  blockOverlayEvents,
  mountOverlayRoot,
  overlayCardCss,
  overlayCountdownCss,
  overlayRootCss,
} from './overlay-shell';

export type ProgressOverlayOptions = {
  id: string;
  brand?: string;
  noteHtml: string;
  status?: string;
  countdownLabel?: string;
  countdownHint?: string;
  blockInteraction?: boolean;
  extraCss?: string;
};

export type ProgressOverlay = {
  root: HTMLElement;
  setStatus: (text: string) => void;
  setNote: (html: string) => void;
  setError: (text: string | null) => void;
  startCountdown: (endTs: number) => void;
  stopCountdown: () => void;
  hideCountdown: () => void;
};

export function createProgressOverlay(options: ProgressOverlayOptions): ProgressOverlay {
  const {
    id,
    brand = 'Skip Wait',
    noteHtml,
    status = 'Getting things ready…',
    countdownLabel = 'Your link opens in',
    countdownHint,
    blockInteraction = true,
    extraCss = '',
  } = options;

  const root = mountOverlayRoot(
    id,
    overlayRootCss(id, 'center') + overlayCardCss(id) + overlayCountdownCss(id) + extraCss,
  );

  if (!blockInteraction) {
    root.style.pointerEvents = 'none';
  }

  const card = document.createElement('div');
  card.className = 'sw-card';
  card.innerHTML =
    `<div class="sw-brand">${brand}</div>` +
    `<div class="sw-note">${noteHtml}</div>` +
    `<div class="sw-status">${status}</div>` +
    '<div class="sw-count" style="display:none"></div>' +
    `<div class="sw-count-label" style="display:none">${countdownLabel}</div>` +
    (countdownHint ? `<div class="sw-count-hint" style="display:none">${countdownHint}</div>` : '') +
    '<div class="sw-err" style="display:none"></div>';
  root.appendChild(card);

  if (blockInteraction) blockOverlayEvents(root);

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
    root,
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
  };
}

export const turnstileWidgetCss =
  '#turnstileContainer,#turnstileWidget{position:fixed!important;left:50%!important;bottom:max(24px,env(safe-area-inset-bottom,0px))!important;top:auto!important;right:auto!important;transform:translateX(-50%)!important;z-index:2147483647!important;pointer-events:auto!important;display:block!important;visibility:visible!important;opacity:1!important;min-width:300px!important;min-height:65px!important;margin:0!important;padding:0!important;border-radius:8px!important;overflow:visible!important;box-shadow:0 12px 32px -10px rgba(0,0,0,.55)!important}#turnstileWidget iframe{pointer-events:auto!important}';
