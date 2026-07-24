import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { CPMLINK_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-cpmlink-overlay';
const BOOT_STYLE_ID = 'skip-wait-cpmlink-boot';
const ALIAS_RE = /^[A-Za-z0-9]{3,}$/;

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

const bootOverlayLock = (): void => {
  const active = overlayActiveClass(OVERLAY_ID);
  document.documentElement.classList.add(active);
  if (document.getElementById(BOOT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOOT_STYLE_ID;
  style.textContent = buildFullPageOverlayCss(OVERLAY_ID, active);
  (document.head || document.documentElement).appendChild(style);
};

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
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

const isRealUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const readInlineAssign = (name: string): string | null => {
  const html = document.documentElement.innerHTML;
  const m = html.match(new RegExp(`(?:var|let|const)?\\s*${name}\\s*=\\s*['"]([^'"]*)['"]`));
  return m?.[1] ?? null;
};

const goForm = (): HTMLFormElement | null =>
  document.querySelector<HTMLFormElement>('#go-link[action*="/links/go2"], form#go-link');

const visitorToken = (): string | null =>
  document.getElementById('continueButton')?.getAttribute('data-token')?.trim() || null;

const isUnlockPage = (): boolean =>
  Boolean(goForm() && visitorToken() && readInlineAssign('_a') && readInlineAssign('_t'));

const visitorSignal = (): string =>
  JSON.stringify({
    t: Math.floor(Date.now() / 1000),
    d: 1.5,
    m: { move: 8, click: 1, scroll: 0, key: 0, touch: 0, focus: 1 },
    f: { webdriver: false, headless: false, noPlugins: false, mobile: false },
  });

const postForm = async (
  url: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown> | null> => {
  try {
    const r = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(fields),
      credentials: 'include',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    return JSON.parse(await r.text()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const runUnlock = async (): Promise<void> => {
  if (started || !isUnlockPage()) return;
  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi('Unlocking your link…');

  const form = goForm();
  const a = readInlineAssign('_a');
  const t = readInlineAssign('_t');
  const d = readInlineAssign('_d') ?? '';
  const visitor = visitorToken();
  if (!form || !a || !t || !visitor) {
    overlay.setStatus('This page isn’t ready yet. Reload and try again.');
    started = false;
    return;
  }

  const alias =
    form.querySelector<HTMLInputElement>('input[name="alias"]')?.value?.trim() ||
    location.pathname.replace(/^\/+|\/+$/g, '');
  const csrf = form.querySelector<HTMLInputElement>('input[name="csrf"]')?.value?.trim() ?? '';
  const goAction = form.getAttribute('action') || `${location.origin}/links/go2`;

  overlay.setStatus('Requesting unlock token…');
  let tk = await postForm(`${location.origin}/get/tk`, { _a: a, _t: t, _d: d });
  if (!tk?.['status'] || typeof tk['th'] !== 'string') {
    await sleep(500);
    tk = await postForm(`${location.origin}/get/tk`, { _a: a, _t: t, _d: d });
  }
  if (!tk?.['status'] || typeof tk['th'] !== 'string') {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    started = false;
    return;
  }

  overlay.setStatus('Unlocking your link…');
  const go = await postForm(goAction, {
    alias,
    csrf,
    tkn: tk['th'],
    visitor_token: visitor,
    signal: visitorSignal(),
  });
  const hop = typeof go?.['url'] === 'string' ? go['url'].trim() : '';
  if (!go || go['status'] !== 'success' || !isRealUrl(hop)) {
    overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
    started = false;
    return;
  }

  overlay.setStatus('Opening your link…');
  location.replace(hop);
};

const tick = (): void => {
  if (isUnlockPage()) void runUnlock();
};

export function initCpmlinkUnlock(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(CPMLINK_HOSTS)) return;
  if (!isAliasPath()) return;

  tick();
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
