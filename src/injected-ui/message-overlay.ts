import {
  blockOverlayEvents,
  mountOverlayRoot,
  overlayBadgeCss,
  overlayCardCss,
  overlayRootCss,
} from './overlay-shell';

export type MessageOverlayOptions = {
  id: string;
  brand?: string;
  noteHtml: string;
  layout?: 'center' | 'top';
};

export function showMessageOverlay(options: MessageOverlayOptions): void {
  const { id, brand = 'Skip Wait', noteHtml, layout = 'top' } = options;
  if (document.getElementById(id)) return;

  const root = mountOverlayRoot(id, overlayRootCss(id, layout) + overlayCardCss(id) + overlayBadgeCss(id));
  const card = document.createElement('div');
  card.className = 'sw-card';
  card.innerHTML = `<div class="sw-brand">${brand}</div><div class="sw-note">${noteHtml}</div>`;
  root.appendChild(card);
  blockOverlayEvents(root);
  document.documentElement.appendChild(root);
}
