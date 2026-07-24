import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['oii.la', 'tpi.li', 'aii.sh', 'lnbz.la', 'shrink.pe'] as const;
const OVERLAY_ID = 'skip-wait-adlinkfly-token-overlay';
const BOOT_STYLE_ID = 'skip-wait-adlinkfly-token-boot';
const TOKEN_INPUT_SELECTOR = 'input[name="token"]';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const TOKEN_HTTP_B64_PREFIX = 'aHR0c';
const TOKEN_HTTP_B64_RE = /^(aHR0c[A-Za-z0-9+/]+={0,2})/;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let done = false;
let ui: FullPageOverlay | null = null;

function padBase64(s: string): string {
  const raw = s.replace(/=+$/, '');
  const p = raw.length % 4;
  return p ? raw + '='.repeat(4 - p) : raw;
}

export function destinationUrlFromAdlinkflyTokenPayload(token: string): string | null {
  const idx = token.indexOf(TOKEN_HTTP_B64_PREFIX);
  if (idx === -1) return null;
  const rest = token.slice(idx).replace(/-/g, '+').replace(/_/g, '/');
  const m = TOKEN_HTTP_B64_RE.exec(rest);
  if (!m?.[1]) return null;
  try {
    const decoded = new TextDecoder('utf-8').decode(
      Uint8Array.from(atob(padBase64(m[1])), (c) => c.charCodeAt(0)),
    );
    const match = decoded.match(/https?:\/\/[^\s\x00-\x1f"']+/);
    return match ? match[0].trim() : null;
  } catch {
    return null;
  }
}

function isTokenPayloadPage(): boolean {
  return !!document.querySelector(TOKEN_INPUT_SELECTOR) && !!document.getElementById(CAPTCHA_WIDGET_ID);
}

function bootOverlayLock(): void {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
}

function mountUi(status = 'Getting things ready…'): FullPageOverlay {
  bootOverlayLock();
  if (ui) {
    ui.setNote(NOTE);
    ui.setStatus(status);
    ui.setError(null);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
  });
  return ui;
}

function redirectFromToken(): void {
  if (done || !isTokenPayloadPage()) return;
  const token = document.querySelector<HTMLInputElement>(TOKEN_INPUT_SELECTOR)?.value?.trim();
  if (!token) return;
  const url = destinationUrlFromAdlinkflyTokenPayload(token);
  if (!url) return;
  done = true;
  mountUi('Redirecting now…');
  location.replace(url);
}

export function initAdlinkflyTokenPayload(): void {
  if (!isAllowedHost(HOSTS)) return;
  if (isTokenPayloadPage()) {
    bootOverlayLock();
    mountUi('Unlocking destination…');
  }
  redirectFromToken();
  whenDomParsed(() => {
    if (!isTokenPayloadPage()) return;
    mountUi('Unlocking destination…');
    redirectFromToken();
  });
}
