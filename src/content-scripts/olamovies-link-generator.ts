import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'olamovies-link-generator';

const LS_TOKEN = 'om_guest_token';
const LS_TOKEN_EXP = 'om_guest_token_exp';
const LS_DAILY = 'om_captcha_daily';
const LS_VISIT_COUNT = 'om_visit_count';

const OMD_ENDPOINT = '/api/omd';
const VISIT_BTN_SEL = 'button.visit-btn';
const HIDE_STYLE_ID = 'sw-ola-hide';
const OVERLAY_ID = 'sw-ola-overlay';
const CFG_READY_ATTR = 'data-sw-ola-cfg-ready';
const REACT_SETTLE_MS = 80;
const CFG_READY_TIMEOUT_MS = 15_000;

const SLUG_RE = /^\/([A-Za-z0-9_-]{6,})\/?$/;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

const OVERLAY_CSS = `
#${OVERLAY_ID}{position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;justify-content:center;padding:12px clamp(12px,3vw,24px);background:linear-gradient(180deg,rgba(15,23,42,.96) 0%,rgba(15,23,42,.88) 100%);backdrop-filter:saturate(140%) blur(8px);-webkit-backdrop-filter:saturate(140%) blur(8px);border-bottom:1px solid rgba(148,163,184,.2);box-shadow:0 10px 32px -12px rgba(0,0,0,.55);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc;pointer-events:none}
#${OVERLAY_ID} .sw-inner{display:flex;align-items:center;gap:14px;width:100%;max-width:880px}
#${OVERLAY_ID} .sw-icon{flex:none;width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px -4px rgba(59,130,246,.55)}
#${OVERLAY_ID} .sw-icon svg{width:18px;height:18px;color:#fff;display:block}
#${OVERLAY_ID} .sw-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
#${OVERLAY_ID} .sw-badge-row{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#60a5fa;line-height:1}
#${OVERLAY_ID} .sw-name{color:#60a5fa}
#${OVERLAY_ID} .sw-step{color:#94a3b8}
#${OVERLAY_ID} .sw-title{margin:2px 0 0;font-size:clamp(.85rem,2.4vw,.95rem);font-weight:700;color:#fff;line-height:1.3;letter-spacing:-.01em}
#${OVERLAY_ID} .sw-desc{margin:2px 0 0;font-size:clamp(.7rem,2vw,.78rem);line-height:1.4;color:#cbd5e1}
#${OVERLAY_ID} .sw-status{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(59,130,246,.14);border:1px solid rgba(59,130,246,.32);font-size:.72rem;font-weight:600;color:#93c5fd;white-space:nowrap}
#${OVERLAY_ID} .sw-spinner{width:12px;height:12px;border:2px solid rgba(147,197,253,.3);border-top-color:#93c5fd;border-radius:50%;animation:sw-spin .8s linear infinite}
#${OVERLAY_ID}.ok .sw-status{background:rgba(52,211,153,.14);border-color:rgba(52,211,153,.32);color:#6ee7b7}
#${OVERLAY_ID}.ok .sw-spinner{border-color:rgba(110,231,183,.3);border-top-color:#6ee7b7}
#${OVERLAY_ID}.err .sw-status{background:rgba(248,113,113,.14);border-color:rgba(248,113,113,.32);color:#fca5a5}
#${OVERLAY_ID}.err .sw-spinner{display:none}
@keyframes sw-spin{to{transform:rotate(360deg)}}
@media (max-width:560px){
  #${OVERLAY_ID}{padding:10px 12px}
  #${OVERLAY_ID} .sw-inner{gap:10px}
  #${OVERLAY_ID} .sw-status{display:none}
  #${OVERLAY_ID} .sw-icon{width:30px;height:30px;border-radius:8px}
}
`;

type OmdResponse = {
  filename?: string;
  shortener?: string;
  shortenedShortener?: string;
  isFound?: boolean;
  error?: string;
};

type OverlayState = 'wait' | 'ok' | 'err';

type Overlay = {
  set: (title: string, desc: string, status: string, state?: OverlayState) => void;
};

function slugFromLocation(): string | null {
  return location.pathname.match(SLUG_RE)?.[1] ?? null;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

function decodeJwtExpMs(jwt: string): number {
  try {
    const part = jwt.split('.')[1];
    if (!part) return 0;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function readCachedToken(): string | null {
  try {
    const tok = localStorage.getItem(LS_TOKEN);
    if (!tok) return null;
    const stored = parseInt(localStorage.getItem(LS_TOKEN_EXP) ?? '0', 10);
    const jwtExp = decodeJwtExpMs(tok);
    const exp = jwtExp || stored;
    return exp > Date.now() + TOKEN_REFRESH_MARGIN_MS ? tok : null;
  } catch {
    return null;
  }
}

function neutralizeVisitCount(): void {
  try {
    localStorage.setItem(LS_DAILY, todayIso());
    localStorage.setItem(LS_VISIT_COUNT, '0');
  } catch {}
}

function hidePageUntilRedirect(): () => void {
  const root = document.documentElement;
  if (!root) return () => {};
  const style = document.createElement('style');
  style.id = HIDE_STYLE_ID;
  style.textContent = `html{visibility:hidden!important}`;
  root.appendChild(style);
  return () => {
    style.remove();
  };
}

function mountOverlay(): Overlay {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <style>${OVERLAY_CSS}</style>
    <div class="sw-inner">
      <div class="sw-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.09 12.97a1 1 0 0 0 .77 1.62H11l-1 7.41a.5.5 0 0 0 .9.34L20 11.5a1 1 0 0 0-.78-1.62H13l1-7.88z"/></svg>
      </div>
      <div class="sw-body">
        <div class="sw-badge-row"><span class="sw-name">Skip Wait</span><span class="sw-step"></span></div>
        <div class="sw-title"></div>
        <div class="sw-desc"></div>
      </div>
      <div class="sw-status"><div class="sw-spinner"></div><span class="sw-status-text"></span></div>
    </div>`;
  document.documentElement.appendChild(root);
  const step = root.querySelector<HTMLElement>('.sw-step')!;
  const title = root.querySelector<HTMLElement>('.sw-title')!;
  const desc = root.querySelector<HTMLElement>('.sw-desc')!;
  const statusText = root.querySelector<HTMLElement>('.sw-status-text')!;
  let stepCounter = 0;
  return {
    set: (t, d, status, state) => {
      stepCounter += 1;
      step.textContent = `\u2022 Step ${stepCounter}`;
      title.textContent = t;
      desc.textContent = d;
      statusText.textContent = status;
      root.className = state ?? 'wait';
    },
  };
}

async function fetchShortener(slug: string, guestToken: string): Promise<OmdResponse | null> {
  try {
    const r = await fetch(OMD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: slug, guestToken }),
    });
    if (!r.ok) return null;
    return (await r.json()) as OmdResponse;
  } catch {
    return null;
  }
}

function watchTokenAppears(): Promise<string> {
  return new Promise((resolve) => {
    const tick = (): void => {
      const t = readCachedToken();
      if (t) return resolve(t);
      setTimeout(tick, 100);
    };
    tick();
  });
}

function isCaptchaConfigReady(): boolean {
  return document.documentElement.getAttribute(CFG_READY_ATTR) === '1';
}

function whenCaptchaConfigReady(): Promise<boolean> {
  if (isCaptchaConfigReady()) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      mo.disconnect();
      clearTimeout(to);
      resolve(ok);
    };
    const mo = new MutationObserver(() => {
      if (isCaptchaConfigReady()) finish(true);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [CFG_READY_ATTR],
    });
    const to = setTimeout(() => finish(false), CFG_READY_TIMEOUT_MS);
  });
}

function autoTriggerVisitNow(): void {
  let armed = true;
  const tryClick = (): boolean => {
    if (!armed) return true;
    const btn = document.querySelector<HTMLButtonElement>(VISIT_BTN_SEL);
    if (!btn || btn.disabled) return false;
    armed = false;
    btn.click();
    return true;
  };

  void (async () => {
    await whenCaptchaConfigReady();
    await new Promise<void>((r) => setTimeout(r, REACT_SETTLE_MS));
    if (tryClick()) return;
    const mo = new MutationObserver(() => {
      if (tryClick()) mo.disconnect();
    });
    mo.observe(document.documentElement, {
      attributeFilter: ['disabled', 'class'],
      attributes: true,
      childList: true,
      subtree: true,
    });
    setTimeout(() => mo.disconnect(), 30_000);
  })();
}

async function instantBypass(slug: string, token: string): Promise<boolean> {
  const restore = hidePageUntilRedirect();
  const resp = await fetchShortener(slug, token);
  if (!resp || resp.error || !resp.isFound || !resp.shortener) {
    restore();
    return false;
  }
  location.replace(resp.shortener);
  return true;
}

async function captchaSolveFlow(slug: string): Promise<void> {
  const overlay = mountOverlay();
  overlay.set(
    'Solve the captcha below to continue',
    'This is a one-time check. Skip Wait will store the 24-hour pass and bypass every olamovies link instantly \u2014 no page load, no ads, no wait \u2014 for the next day.',
    'Waiting for captcha\u2026',
    'wait',
  );
  autoTriggerVisitNow();
  const token = await watchTokenAppears();
  overlay.set(
    'Captcha verified \u2014 fetching your link',
    'Talking directly to the olamovies API to resolve the destination URL. No more redirects.',
    'Resolving\u2026',
    'wait',
  );
  const resp = await fetchShortener(slug, token);
  if (!resp || resp.error || !resp.isFound || !resp.shortener) {
    overlay.set(
      'Link unavailable',
      resp?.error ?? 'The file may be expired or removed by the host.',
      'Failed',
      'err',
    );
    return;
  }
  overlay.set(
    `Opening ${resp.shortenedShortener ?? 'your link'}`,
    'Redirecting now. From your next olamovies link onward, Skip Wait will redirect instantly with zero page load.',
    'Redirecting',
    'ok',
  );
  location.replace(resp.shortener);
}

async function run(): Promise<void> {
  const slug = slugFromLocation();
  if (!slug) return;

  neutralizeVisitCount();

  const cached = readCachedToken();
  if (cached) {
    const ok = await instantBypass(slug, cached);
    if (ok) return;
  }

  await captchaSolveFlow(slug);
}

export function initOlamoviesLinkGenerator(): void {
  if (window !== window.top || !isAllowedHost(getHostsByKey(KEY))) return;
  if (!slugFromLocation()) return;
  void run();
}
