import { cardStyles, type CardStatus } from './card';

export type BannerOverlayOptions = {
  id: string;
  badge?: string;
  title: string;
  description: string;
  status?: string;
};

export type BannerOverlay = {
  setStatus: (text: string, variant?: CardStatus) => void;
};

function statusStyle(variant: CardStatus): string {
  if (variant === 'success') return cardStyles.statusSuccess;
  if (variant === 'error') return cardStyles.statusError;
  return cardStyles.status;
}

export function createBannerOverlay(options: BannerOverlayOptions): BannerOverlay {
  const backdrop = document.createElement('div');
  backdrop.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:2147483640;background:rgba(10,12,18,.55);backdrop-filter:blur(2px) saturate(.85);-webkit-backdrop-filter:blur(2px) saturate(.85);',
  );

  const card = document.createElement('div');
  card.id = options.id;
  card.setAttribute(
    'style',
    `${cardStyles.card};position:fixed;top:max(env(safe-area-inset-top,0px),16px);left:50%;transform:translateX(-50%);max-width:min(440px,calc(100vw - 32px));z-index:2147483645;margin:0;`,
  );

  const badge = options.badge
    ? `<div style="${cardStyles.badge}">${options.badge}</div>`
    : '';
  card.innerHTML =
    `${badge}<h2 style="${cardStyles.title}">${options.title}</h2>` +
    `<p style="${cardStyles.description}">${options.description}</p>`;

  const status = document.createElement('p');
  status.setAttribute('style', cardStyles.status);
  status.textContent = options.status ?? '';
  card.appendChild(status);
  document.body.append(backdrop, card);

  return {
    setStatus(text, variant = 'default') {
      status.textContent = text;
      status.setAttribute('style', statusStyle(variant));
    },
  };
}
