import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { GENLINK_ENTRY_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-genlink-entry';
const BOOT_STYLE_ID = 'skip-wait-genlink-entry-boot';
const ALIAS_RE = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,}$/;
const JAZBAAT_URL_RE = /https:\/\/jazbaat\.in\/[A-Za-z0-9\-]+\/?/gi;
const JAZBAAT_IN_GOOGLE_RE = /url=(https?:\/\/jazbaat\.in\/[^&"'\\]+)/gi;

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

const isAliasPath = (): boolean => {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return parts.length === 1 && ALIAS_RE.test(parts[0]!);
};

const extractJazbaatUrl = (html: string): string | null => {
  const decoded = html.replace(/&amp;/g, '&').replace(/\\\//g, '/');
  for (const re of [JAZBAAT_IN_GOOGLE_RE, JAZBAAT_URL_RE]) {
    re.lastIndex = 0;
    const m = re.exec(decoded);
    if (!m) continue;
    const raw = m[1] ?? m[0]!;
    try {
      const u = new URL(decodeURIComponent(raw));
      if (u.hostname === 'jazbaat.in' || u.hostname.endsWith('.jazbaat.in')) return u.href;
    } catch {}
  }
  return null;
};

const tick = (): void => {
  if (started) return;
  const url = extractJazbaatUrl(document.documentElement.innerHTML);
  if (!url) return;
  started = true;
  mountUi('Skipping browser check…');
  location.replace(url);
};

export function initGenlinkEntry(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(GENLINK_ENTRY_HOSTS)) return;
  if (!isAliasPath()) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
