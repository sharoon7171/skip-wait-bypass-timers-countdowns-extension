import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { hostnameMatches, isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { GPLINKS_HOSTS } from './hosts';
import { GPLINKS_MEDIATOR_HOSTS } from './mediator-hosts';

const OVERLAY_ID = 'skip-wait-gplinks-mediator';
const RUN_KEY = 'skip-wait-gplinks-mediator-run';
const FORM_SEL = '#adsForm';
const STEP_WAIT_MS = 30_000;

type MediatorCookies = {
  lid: string;
  pid: string;
  vid: string;
  pages: number;
  stepCount: number;
  imps: number;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): void => {
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
};

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=600;secure;samesite=lax`;
}

function readMediatorCookies(): MediatorCookies | null {
  const lid = readCookie('lid');
  const pid = readCookie('pid');
  const vid = readCookie('vid');
  const pages = Number(readCookie('pages') || 0);
  const stepCount = Number(readCookie('step_count') || 0);
  const imps = Number(readCookie('imps') || 0);
  if (!lid || !pid || !vid || !Number.isFinite(pages) || pages < 1) return null;
  return { lid, pid, vid, pages, stepCount, imps };
}

function isMediatorPage(): boolean {
  if (!isAllowedHost(GPLINKS_MEDIATOR_HOSTS)) return false;
  if (!document.querySelector(FORM_SEL)) return false;
  return !!readMediatorCookies();
}

function stripAdblockUi(): void {
  document.getElementById('AdbModel')?.remove();
  for (const el of document.querySelectorAll('.adb-overlay, .adb-popup')) el.remove();
  document.body.style.removeProperty('overflow');
}

function finalUrl(c: MediatorCookies): string {
  return `https://gplinks.co/${encodeURIComponent(c.lid)}?pid=${encodeURIComponent(c.pid)}&vid=${encodeURIComponent(c.vid)}`;
}

function collectStepTargets(need: number): string[] {
  const globalPosts = (window as unknown as { postsArray?: unknown }).postsArray;
  const fromGlobal = Array.isArray(globalPosts)
    ? globalPosts.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
    : [];
  const scraped = [
    ...document.querySelectorAll<HTMLAnchorElement>(`a[href^="${location.origin}/"]`),
  ]
    .map((a) => a.href)
    .filter((href) => {
      try {
        const u = new URL(href);
        if (u.pathname === '/' || u.pathname === location.pathname) return false;
        if (/\/(?:category|tag|author|page|feed|wp-|comments)/i.test(u.pathname)) return false;
        return u.pathname.length > 1;
      } catch {
        return false;
      }
    });
  const unique = [...new Set(fromGlobal.length ? fromGlobal : scraped)];
  if (unique.length === 0) return Array.from({ length: need }, () => location.href);
  return Array.from({ length: need }, (_, i) => unique[i % unique.length]!);
}

function mountUi(step: number, pages: number): FullPageOverlay {
  return createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: {
      lead: 'Bypassing GPLinks mediator…',
      detail: `Step ${step} of ${pages} — waiting the verified window, then continuing.`,
    },
    status: 'Waiting…',
    countdownLabel: 'Continue in',
  });
}

async function runStep(ui: FullPageOverlay): Promise<void> {
  const cookies = readMediatorCookies();
  if (!cookies) return;

  const step = cookies.stepCount + 1;
  if (step > cookies.pages) {
    location.replace(finalUrl(cookies));
    return;
  }

  requestVisibilitySpoof();
  stripAdblockUi();

  const endAt = Date.now() + STEP_WAIT_MS;
  ui.setNote({
    lead: 'Bypassing GPLinks mediator…',
    detail: `Step ${step} of ${cookies.pages} — waiting the verified window, then continuing.`,
  });
  ui.setStatus(`Waiting ${STEP_WAIT_MS / 1000}s before step ${step}…`);
  ui.startCountdown(endAt);
  await sleep(STEP_WAIT_MS);
  ui.hideCountdown();

  const form = document.querySelector<HTMLFormElement>(FORM_SEL);
  if (!form) {
    ui.setStatus('Mediator form missing — reload and try again.');
    return;
  }

  const ready = step >= cookies.pages;
  const targets = collectStepTargets(Math.max(0, cookies.pages - 1));
  const nextTarget = ready ? finalUrl(cookies) : (targets[step - 1] ?? location.href);

  writeCookie('step_count', String(step));
  writeCookie('imps', '0');

  const stepId = form.elements.namedItem('step_id');
  const adImps = form.elements.namedItem('ad_impressions');
  const visitorId = form.elements.namedItem('visitor_id');
  const nextField = form.elements.namedItem('next_target');
  if (
    !(stepId instanceof HTMLInputElement) ||
    !(adImps instanceof HTMLInputElement) ||
    !(visitorId instanceof HTMLInputElement) ||
    !(nextField instanceof HTMLInputElement)
  ) {
    ui.setStatus('Mediator form fields missing — reload and try again.');
    return;
  }

  stepId.value = String(step);
  adImps.value = String(cookies.imps);
  visitorId.value = cookies.vid;
  nextField.value = nextTarget;

  ui.setStatus(ready ? 'Opening GPLinks…' : `Continuing to step ${step}…`);
  form.submit();
}

export function initGplinksMediator(): void {
  whenDomParsed(() => {
    if (!isMediatorPage()) return;
    if (hostnameMatches(location.hostname, GPLINKS_HOSTS)) return;
    if (sessionStorage.getItem(RUN_KEY) === location.href) return;
    sessionStorage.setItem(RUN_KEY, location.href);
    const cookies = readMediatorCookies();
    if (!cookies) return;
    const step = Math.min(cookies.stepCount + 1, cookies.pages);
    const ui = mountUi(step, cookies.pages);
    void runStep(ui).catch(() => {
      ui.setStatus('Something went wrong — reload and try again.');
    });
  });
}
