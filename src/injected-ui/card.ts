import { pageUiColors, pageUiRadius, PAGE_UI_FONT } from './tokens';

const { cardGradientAlt, cardShadowInset, badgeBg, badgeBorder, accentSoft, textPrimary, textMuted, errorStrong, btnGradient, btnShadow } =
  pageUiColors;

export const cardStyles = {
  card: `box-sizing:border-box;width:100%;min-width:0;margin:clamp(1rem,4vw,1.5rem) 0;padding:clamp(1rem,4vw,1.375rem) clamp(1.25rem,5vw,1.625rem);background:${cardGradientAlt};border-radius:${pageUiRadius.cardSm};box-shadow:${cardShadowInset};font-family:${PAGE_UI_FONT};font-size:clamp(0.875rem,2vw,1rem);color:${textPrimary};`,
  badge: `display:inline-block;margin:0 0 0.75rem;padding:0.3125rem 0.75rem;background:${badgeBg};color:${accentSoft};font-size:0.6875rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:${pageUiRadius.badge};border:1px solid ${badgeBorder};`,
  title: `margin:0 0 0.5rem;font-size:clamp(1.125rem,3vw,1.25rem);font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1.25;`,
  description: `margin:0 0 1rem;font-size:1em;line-height:1.55;color:${textMuted};`,
  status: `margin:0 0 1rem;font-size:1em;line-height:1.55;color:${textMuted};`,
  statusSuccess: `margin:0 0 1rem;font-size:1em;line-height:1.55;color:${accentSoft};`,
  statusError: `margin:0 0 1rem;font-size:1em;line-height:1.55;color:${errorStrong};`,
  btn: `display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;padding:clamp(0.625rem,2vw,0.75rem) clamp(1rem,4vw,1.5rem);background:${btnGradient};color:#fff;border:none;border-radius:${pageUiRadius.btn};font-size:0.875rem;font-weight:700;cursor:pointer;box-shadow:${btnShadow};`,
  actions: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;',
} as const;

export type CardStatus = 'default' | 'success' | 'error';

export type InlineCardOptions = {
  id: string;
  badge?: string;
  title?: string;
  description?: string;
  status?: string;
  bodyHtml?: string;
  actionsHtml?: string;
};

export type InlineCard = {
  root: HTMLElement;
  setStatus: (text: string, variant?: CardStatus) => void;
  setTitle: (text: string) => void;
  setDescription: (html: string) => void;
  button: (id: string) => HTMLButtonElement | null;
};

function statusStyle(variant: CardStatus): string {
  if (variant === 'success') return cardStyles.statusSuccess;
  if (variant === 'error') return cardStyles.statusError;
  return cardStyles.status;
}

export function createInlineCard(options: InlineCardOptions): InlineCard {
  const parts: string[] = [];
  if (options.badge) parts.push(`<div style="${cardStyles.badge}">${options.badge}</div>`);
  if (options.title) parts.push(`<h3 style="${cardStyles.title}">${options.title}</h3>`);
  if (options.description) parts.push(`<p style="${cardStyles.description}">${options.description}</p>`);
  if (options.status !== undefined) {
    parts.push(`<p style="${cardStyles.status}" data-sw-status>${options.status}</p>`);
  }
  if (options.bodyHtml) parts.push(options.bodyHtml);
  if (options.actionsHtml) parts.push(options.actionsHtml);

  const root = document.createElement('div');
  root.id = options.id;
  root.setAttribute('style', cardStyles.card);
  root.innerHTML = parts.join('');

  const statusEl = root.querySelector<HTMLElement>('[data-sw-status]');

  return {
    root,
    setStatus(text, variant = 'default') {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.setAttribute('style', statusStyle(variant));
    },
    setTitle(text) {
      const titleEl = root.querySelector('h3');
      if (titleEl) titleEl.textContent = text;
    },
    setDescription(html) {
      const descEl = root.querySelector('p');
      if (descEl && !descEl.hasAttribute('data-sw-status')) descEl.innerHTML = html;
    },
    button(id) {
      return root.querySelector<HTMLButtonElement>(`#${CSS.escape(id)}`);
    },
  };
}

export function cardButton(id: string, label: string, disabled = false): string {
  const disabledAttr = disabled ? ' disabled' : '';
  return `<button type="button" style="${cardStyles.btn}" id="${id}"${disabledAttr}>${label}</button>`;
}

export function cardActionsRow(buttonsHtml: string): string {
  return `<div style="${cardStyles.actions}">${buttonsHtml}</div>`;
}
