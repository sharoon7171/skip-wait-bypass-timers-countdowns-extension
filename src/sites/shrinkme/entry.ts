import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { SHRINKME_ENTRY_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-shrinkme-entry';
const BOOT_STYLE_ID = 'skip-wait-shrinkme-entry-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
const THEMEZON_LINK = 'https://themezon.net/link.php?link=';

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

const aliasFromPath = (): string | null => {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const alias = parts[0]!;
  return ALIAS_RE.test(alias) ? alias : null;
};

export function initShrinkmeEntry(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(SHRINKME_ENTRY_HOSTS)) return;
  if (started) return;
  const alias = aliasFromPath();
  if (!alias) return;
  started = true;
  mountUi('Skipping captcha gate…');
  location.replace(THEMEZON_LINK + encodeURIComponent(alias));
}
