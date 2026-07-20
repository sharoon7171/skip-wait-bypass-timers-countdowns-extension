import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { isAllowedHost } from '../../utils/domain-check';
import { ICUTLINK_MEDIATOR_HOSTS } from './mediator-hosts';

const OVERLAY_ID = 'skip-wait-icutlink-mediator';
const BOOT_STYLE_ID = 'skip-wait-icutlink-mediator-boot';
const STEP_INPUT = 'form input[name="step"]';
const GETL = '#getl';
const AFTER_BTN = '#afterBtn';
const PROGRESS_BAR = '#progressBar';
const PROGRESS_SECTION = '#progressSection';
const BUTTON_SECTION = '#buttonSection';
const TOTAL_PAGES = 3;
const DEFAULT_STEP1_MS = 26_000;

const NOTE = {
  lead: 'Unlocking ToolsKit…',
  detail: 'Page 1 waits for the server timer. Pages 2–3 continue right away.',
} as const;

let ui: FullPageOverlay | null = null;
let started = false;
let covered = false;

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

const pageStatus = (page: string | number, text: string): string =>
  `Page ${page}/${TOTAL_PAGES} — ${text}`;

const mountUi = (status = 'Getting ready…'): FullPageOverlay => {
  bootOverlayLock();
  covered = true;
  if (ui) {
    ui.setNote(NOTE);
    ui.setStatus(status);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: NOTE,
    status,
    countdownLabel: 'Continue in',
  });
  return ui;
};

const stepForm = (): HTMLFormElement | null => {
  const input = document.querySelector<HTMLInputElement>(STEP_INPUT);
  if (!input) return null;
  return input.closest('form');
};

const currentPage = (): string =>
  stepForm()?.querySelector<HTMLInputElement>('input[name="step"]')?.value?.trim() || '';

const getlHref = (): string | null => {
  const a = document.querySelector<HTMLAnchorElement>(GETL);
  const href = a?.href?.trim() ?? '';
  return /^https?:\/\//i.test(href) ? href : null;
};

const isRespectError = (): boolean => /Respect the timer/i.test(document.body?.innerText ?? '');

const isMediatorPage = (): boolean =>
  !!stepForm() || !!getlHref() || !!document.querySelector(PROGRESS_BAR) || isRespectError();

const parseDurationMs = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^([\d.]+)\s*(s|ms)?$/i);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return (m[2] || 's').toLowerCase() === 'ms' ? Math.round(n) : Math.round(n * 1000);
};

const step1WaitMs = (): number => {
  const bar = document.querySelector<HTMLElement>(PROGRESS_BAR);
  if (bar) {
    const fromVar = parseDurationMs(bar.style.getPropertyValue('--duration') || null);
    if (fromVar && fromVar > 0) return fromVar;
    const fromTransition = parseDurationMs(getComputedStyle(bar).transitionDuration.split(',')[0]?.trim());
    if (fromTransition && fromTransition > 0) return fromTransition;
  }
  return DEFAULT_STEP1_MS;
};

const nextReady = (): boolean => {
  if (getlHref()) return true;
  const btnSec = document.querySelector<HTMLElement>(BUTTON_SECTION);
  if (btnSec?.classList.contains('show') && getComputedStyle(btnSec).opacity !== '0') return true;
  const progress = document.querySelector<HTMLElement>(PROGRESS_SECTION);
  if (!progress) return !!document.querySelector(AFTER_BTN);
  if (progress.classList.contains('hidden') || getComputedStyle(progress).display === 'none') {
    return !!document.querySelector(AFTER_BTN);
  }
  return false;
};

const waitPage1 = async (overlay: FullPageOverlay): Promise<void> => {
  const total = step1WaitMs();
  const endAt = Date.now() + total;
  overlay.setStatus(pageStatus(1, 'waiting…'));
  overlay.startCountdown(endAt);
  while (Date.now() < endAt) {
    if (nextReady()) break;
    await sleep(150);
  }
  overlay.hideCountdown();
};

const coverIfMediator = (): void => {
  if (covered || !isMediatorPage()) return;
  const page = currentPage() || '1';
  mountUi(pageStatus(page, 'starting…'));
};

const run = (): void => {
  if (started || !isMediatorPage()) return;
  started = true;
  requestVisibilitySpoof();
  const overlay = mountUi();

  void (async () => {
    if (isRespectError()) {
      overlay.setStatus('Timer rejected — reload the short link and try again.');
      return;
    }

    const dest = getlHref();
    if (dest) {
      overlay.setStatus(pageStatus(3, 'opening short link…'));
      location.replace(dest);
      return;
    }

    const form = stepForm();
    if (!form) {
      overlay.setStatus('Mediator form missing — open the short link again.');
      started = false;
      return;
    }

    const page = currentPage() || '?';
    if (page === '1' && !nextReady()) {
      await waitPage1(overlay);
    }

    overlay.setStatus(pageStatus(page, 'continuing…'));
    form.submit();
  })().catch(() => {
    overlay.setStatus('Something went wrong — open the short link again.');
    started = false;
  });
};

export function initIcutlinkMediatorPage(): void {
  if (!isAllowedHost(ICUTLINK_MEDIATOR_HOSTS)) return;
  if (!/\/tools\/?$/i.test(location.pathname)) return;

  const tick = (): void => {
    coverIfMediator();
    run();
  };

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    tick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
}
