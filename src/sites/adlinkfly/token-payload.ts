import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost } from '../../utils/domain-check';

const HOSTS = [
  'oii.la',
  'tpi.li',
] as const;
const OVERLAY_ID = 'skip-wait-adlinkfly-token-overlay';
const CAPTCHA_WIDGET_ID = 'captchaShortlink';
const TOKEN_INPUT_SELECTOR = 'input[name="token"]';
const TOKEN_HTTP_B64_PREFIX = 'aHR0c';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const TURNSTILE_READY_SELECTOR = 'iframe, .cf-turnstile, input[name="cf-turnstile-response"]';
const CAPTCHA_NOTE = {
  lead: 'Confirm you’re human.',
  detail: 'Tap the checkbox below. We’ll continue automatically when it’s done.',
} as const;

let done = false;
let pinned = false;
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
  if (pinned || !isTurnstileWidgetReady()) return;
  const box = document.getElementById(CAPTCHA_WIDGET_ID);
  if (!box) return;
  const overlay = mountUi();
  if (box.parentElement !== overlay.turnstileMount) {
    overlay.turnstileMount.replaceChildren(box);
    box.style.cssText =
      'display:inline-block!important;margin:0 auto!important;pointer-events:auto!important;';
  }
  overlay.setStatus('Complete the captcha below.');
  pinned = true;
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