import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { SHRINKME_MEDIATOR_HOSTS, SHRINKME_UNLOCK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-shrinkme-mediator';
const BOOT_STYLE_ID = 'skip-wait-shrinkme-mediator-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
const UNLOCK_ORIGIN = `https://${SHRINKME_UNLOCK_HOSTS[0]}`;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

const bootOverlayLock = (): void => {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
};

const mountUi = (status: string): FullPageOverlay => {
  bootOverlayLock();
  if (ui) {
    ui.setStatus(status);
    ui.setError(null);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
    countdownLabel: 'Your link opens in',
  });
  return ui;
};

const readCookie = (name: string): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

const aliasFromPage = (): string | null => {
  const fromQuery = new URLSearchParams(location.search).get('link')?.trim();
  if (fromQuery && ALIAS_RE.test(fromQuery)) return fromQuery;

  const input = document.querySelector<HTMLInputElement>('input[name="newwpsafelink"]')?.value?.trim();
  if (input && ALIAS_RE.test(input)) return input;

  const cookie = readCookie('tp')?.trim();
  if (cookie && ALIAS_RE.test(cookie)) return cookie;

  const html = document.documentElement.innerHTML;
  const mrpro = html.match(/https?:\/\/en\.mrproblogger\.com\/([A-Za-z0-9]+)/i);
  if (mrpro?.[1] && ALIAS_RE.test(mrpro[1])) return mrpro[1];

  return null;
};

const isMediatorPage = (): boolean => {
  if (/\/link\.php$/i.test(location.pathname)) return true;
  if (document.querySelector('form[name="tp"], input[name="newwpsafelink"]')) return true;
  if (readCookie('tp')) return true;
  return /en\.mrproblogger\.com\//i.test(document.documentElement.innerHTML);
};

const tick = (): void => {
  if (started || !isMediatorPage()) return;
  const alias = aliasFromPage();
  if (!alias) return;
  started = true;
  mountUi('Skipping mediator…');
  location.replace(`${UNLOCK_ORIGIN}/${encodeURIComponent(alias)}`);
};

export function initShrinkmeMediator(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(SHRINKME_MEDIATOR_HOSTS)) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
