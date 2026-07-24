import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['shrtslug.biz'] as const;
const OVERLAY_ID = 'skip-wait-shrtslug-overlay';
const BOOT_STYLE_ID = 'skip-wait-shrtslug-boot';
const FORM = 'form[action*="api-endpoint/verify"]';

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

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
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
};

const run = (): void => {
  if (started) return;
  const form = document.querySelector<HTMLFormElement>(FORM);
  if (!form) return;
  started = true;
  const overlay = mountUi('Unlocking your link…');

  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, String(v)));
  const action = form.getAttribute('action') || `${location.origin}/api-endpoint/verify`;

  void fetch(action, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
    .then((r) => r.json())
    .then((d: { status?: string; data?: { final?: string } }) => {
      const u = d?.data?.final?.trim();
      if (d?.status === 'success' && /^https?:\/\//i.test(u ?? '')) {
        overlay.setStatus('Opening your link…');
        location.replace(u!);
        return;
      }
      overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
      started = false;
    })
    .catch(() => {
      overlay.setStatus('Couldn’t unlock this link. Reload and try again.');
      started = false;
    });
};

export function initShrtslugRedirect(): void {
  if (window !== window.top) return;
  if (!isAllowedHost(HOSTS)) return;

  bootOverlayLock();
  mountUi('Getting things ready…');

  const tick = (): void => {
    if (started) return;
    run();
  };

  whenDomParsed(tick);
  const mo = new MutationObserver(tick);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', tick, true);
}
