import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { GENLINK_MEDIATOR_HOSTS, GENLINK_UNLOCK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-genlink-mediator';
const BOOT_STYLE_ID = 'skip-wait-genlink-mediator-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
const UNLOCK_ORIGIN = `https://${GENLINK_UNLOCK_HOSTS[0]}`;

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
  const tp2 = document.querySelector<HTMLInputElement>('input[name="tp2"]')?.value?.trim();
  if (tp2 && ALIAS_RE.test(tp2)) return tp2;
  const cookie = readCookie('tp')?.trim();
  if (cookie && ALIAS_RE.test(cookie)) return cookie;
  const html = document.documentElement.innerHTML;
  const open = html.match(/https?:\/\/crazymindhub\.xyz\/([A-Za-z0-9]+)/i);
  if (open?.[1] && ALIAS_RE.test(open[1])) return open[1];
  const cookieScript = html.match(/document\.cookie\s*=\s*['"]tp=([^;'"]+)/i);
  if (cookieScript?.[1] && ALIAS_RE.test(cookieScript[1])) return cookieScript[1];
  return null;
};

const isMediatorPage = (): boolean => {
  if (document.querySelector('form[name="tp"], #conti, #btn6, button#link[onclick*="verify"]')) {
    return true;
  }
  const html = document.documentElement.innerHTML;
  return (
    /function\s+verify\s*\(/.test(html) ||
    /function\s+getlink\s*\(/.test(html) ||
    /document\.cookie\s*=\s*['"]tp=/.test(html)
  );
};

const tick = (): void => {
  if (started || !isMediatorPage()) return;
  const alias = aliasFromPage();
  if (!alias) return;
  started = true;
  mountUi('Skipping mediator…');
  location.replace(`${UNLOCK_ORIGIN}/${encodeURIComponent(alias)}`);
};

export function initGenlinkMediator(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(GENLINK_MEDIATOR_HOSTS)) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
