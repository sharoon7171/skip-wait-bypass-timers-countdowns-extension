import {
  escapeHtml,
  mountOverlayRoot,
  overlayBadgeCss,
  overlayCardCss,
  overlayFileCss,
  overlayRootCss,
  overlayStatusCss,
} from './overlay-shell';

export type StatusOverlayFile = {
  name: string;
  size?: string | null;
};

export type StatusOverlayOptions = {
  id: string;
  badge?: string;
  title?: string;
  file?: StatusOverlayFile | null;
  message?: string;
};

export type StatusOverlay = {
  setStatus: (message: string, state?: 'ok' | 'err') => void;
};

export function createStatusOverlay(options: StatusOverlayOptions): StatusOverlay {
  const { id, badge = 'Skip Wait', title = 'Preparing your download', file, message = 'Generating direct link…' } =
    options;

  const root = mountOverlayRoot(
    id,
    overlayRootCss(id, 'top') +
      overlayCardCss(id) +
      overlayBadgeCss(id) +
      overlayFileCss(id) +
      overlayStatusCss(id),
  );

  const fileBlock = file
    ? `<div class="sw-file"><b>${escapeHtml(file.name)}</b>${file.size ? `<span>${escapeHtml(file.size)}</span>` : ''}</div>`
    : '';

  const card = document.createElement('div');
  card.className = 'sw-card';
  card.innerHTML =
    `<div class="sw-badge">${badge}</div>` +
    `<div class="sw-title">${title}</div>` +
    `${fileBlock}` +
    '<div class="sw-status-row"><div class="sw-spinner"></div><span class="sw-text"></span></div>';
  root.appendChild(card);
  (document.body ?? document.documentElement).appendChild(root);

  const row = root.querySelector<HTMLElement>('.sw-status-row')!;
  const text = root.querySelector<HTMLElement>('.sw-text')!;
  text.textContent = message;

  return {
    setStatus(msg, state) {
      text.textContent = msg;
      row.className = state ? `sw-status-row ${state}` : 'sw-status-row';
    },
  };
}
