import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { pinSiteWidgetOverOverlay } from '../../injected-ui/pin-site-widget';
import { isAllowedHost } from '../../utils/domain-check';

const HOSTS = [
  'oii.la',
  'tpi.li',
] as const;
const OVERLAY_ID = 'skip-wait-adlinkfly-token-overlay';
const CAPTCHA_PIN_STYLE_ID = 'skip-wait-adlinkfly-token-captcha-pin';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const TOKEN_INPUT_SELECTOR = 'input[name="token"]';
const TOKEN_HTTP_B64_PREFIX = 'aHR0c';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const TURNSTILE_READY_SELECTOR = 'iframe, .cf-turnstile, input[name="cf-turnstile-response"]';
const TURNSTILE_IFRAMES = [
  'iframe[src*="challenges.cloudflare.com"]',
  'iframe[src*="turnstile"]',
] as const;
const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Tap the checkbox below. We’ll continue automatically when it’s done.',
} as const;

let done = false;
let stopPin: (() => void) | null = null;
let ui: FullPageOverlay | null = null;

function padBase64(s: string): string {
  const p = s.length % 4;
  return p ? s + '='.repeat(4 - p) : s;
}

function isCloudflareDone(root: Element | Document): boolean {
  const token = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(TURNSTILE_RESPONSE)?.value?.trim();
  if (token?.length) return true;
  return /\bcf_clearance=/.test(document.cookie);
}

function destinationUrlFromAdlinkflyTokenPayload(token: string): string | null {
  const idx = token.indexOf(TOKEN_HTTP_B64_PREFIX);
  if (idx === -1) return null;
  const normalized = token.slice(idx).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(padBase64(normalized));
    const decoded = new TextDecoder('utf-8').decode(
      Uint8Array.from(bin, (c) => c.charCodeAt(0)),
    );
    const match = decoded.match(/https?:\/\/[^\s\x00-\x1f"']+/);
    return match ? match[0].trim() : null;
  } catch {
    return null;
  }
}

function mountUi(): FullPageOverlay {
  if (ui) return ui;
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: CAPTCHA_NOTE,
    status: 'Waiting for captcha…',
  });
  return ui;
}

function isTokenCaptchaPage(): boolean {
  return !!document.querySelector(TOKEN_INPUT_SELECTOR) && !!document.getElementById(CAPTCHA_WIDGET_ID);
}

function isTurnstileWidgetReady(): boolean {
  return !!document.getElementById(CAPTCHA_WIDGET_ID)?.querySelector(TURNSTILE_READY_SELECTOR);
}

function ensurePin(): void {
  if (stopPin || !isTurnstileWidgetReady()) return;
  if (!document.getElementById(CAPTCHA_WIDGET_ID)) return;
  const overlay = mountUi();
  stopPin = pinSiteWidgetOverOverlay({
    overlayId: OVERLAY_ID,
    mount: overlay.turnstileMount,
    widgetId: CAPTCHA_WIDGET_ID,
    styleId: CAPTCHA_PIN_STYLE_ID,
    alsoVisibleSelectors: TURNSTILE_IFRAMES,
  });
  overlay.setStatus('Complete the captcha below.');
}

function tryRedirect(): void {
  if (done) return;
  const input = document.querySelector<HTMLInputElement>(TOKEN_INPUT_SELECTOR);
  if (!input || !isCloudflareDone(document)) return;
  const token = input.value?.trim();
  if (!token) return;
  const url = destinationUrlFromAdlinkflyTokenPayload(token);
  if (!url) return;
  done = true;
  stopPin?.();
  stopPin = null;
  mountUi().setStatus('Redirecting now…');
  window.location.replace(url);
}

function tick(): void {
  if (isTokenCaptchaPage()) {
    if (isTurnstileWidgetReady()) {
      mountUi();
      ensurePin();
    }
  }
  tryRedirect();
  if (!done) requestAnimationFrame(tick);
}

export function initAdlinkflyTokenPayload(): void {
  if (!isAllowedHost(HOSTS)) return;
  const run = () => requestAnimationFrame(tick);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
}
