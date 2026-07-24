import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { CPMLINK_HOP_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-cpmlink-hop';
const BOOT_STYLE_ID = 'skip-wait-cpmlink-hop-boot';
const DEST_URL_RE = /\burl\s*=\s*['"](https?:\/\/[^'"]+)['"]/;

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

const mountUi = (status = 'Opening your link…'): FullPageOverlay => {
  bootOverlayLock();
  if (ui) {
    ui.setStatus(status);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
  });
  return ui;
};

const destinationFromHtml = (html: string): string | null => {
  const m = DEST_URL_RE.exec(html);
  const url = m?.[1]?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (/ppcnt\./i.test(url)) return null;
  return url;
};

const tick = (): void => {
  if (started) return;
  const url = destinationFromHtml(document.documentElement.innerHTML);
  if (!url) return;
  started = true;
  mountUi('Opening your link…');
  location.replace(url);
};

export function initCpmlinkHop(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(CPMLINK_HOP_HOSTS)) return;
  if (!/^\/ph\//i.test(location.pathname)) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
