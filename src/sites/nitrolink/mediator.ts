import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { hostnameMatches, isAllowedHost } from '../../utils/domain-check';
import {
  ensureNitrolinkChain,
  isNitrolinkShortenerHref,
  nitrolinkAliasFromPath,
  nitrolinkAliasFromSearch,
  readNitrolinkChain,
  shortenerUrl,
} from './chain';
import { NITROLINK_HOSTS, NITROLINK_MEDIATOR_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-nitrolink-mediator';
const BOOT_STYLE_ID = 'skip-wait-nitrolink-mediator-boot';
const NEXT_SEL = '#moobiedatNextLink';
const STATUS_SEL = '.moobiedat-status';
const NEXT_RE =
  /id=["']moobiedatNextLink["'][^>]*href=["']([^"']+)["']/i;
const NEXT_RE_ALT =
  /href=["']([^"']+)["'][^>]*id=["']moobiedatNextLink["']/i;

let ui: FullPageOverlay | null = null;
let started = false;
let resumeStarted = false;

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

const decodeHref = (raw: string): string =>
  raw
    .replace(/&amp;/g, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&#x0*26;/gi, '&')
    .trim();

const parseStep = (): { step: number; total: number } | null => {
  const text = document.querySelector(STATUS_SEL)?.textContent?.trim() ?? '';
  const m = text.match(/Step\s+(\d+)\s+of\s+(\d+)/i);
  if (!m) return null;
  const step = parseInt(m[1]!, 10);
  const total = parseInt(m[2]!, 10);
  if (!Number.isFinite(step) || !Number.isFinite(total) || step < 1 || total < 1) return null;
  return { step, total };
};

const noteForStep = (step: number | null, total: number | null) => {
  if (step && total) {
    return {
      lead: 'Hang tight — unlocking your link.',
      detail: `Step ${step} of ${total}. Skip Wait is skipping these waiting pages for you.`,
    };
  }
  return {
    lead: 'Hang tight — unlocking your link.',
    detail: 'Skip Wait is skipping these waiting pages for you.',
  };
};

const mountUi = (status = 'Getting things ready…'): FullPageOverlay => {
  bootOverlayLock();
  const stepInfo = parseStep();
  const note = noteForStep(stepInfo?.step ?? null, stepInfo?.total ?? null);
  if (ui) {
    ui.setNote(note);
    ui.setStatus(status);
    return ui;
  }
  ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note,
    status,
    countdownLabel: 'Your link opens in',
  });
  return ui;
};

const isMoobiedatGate = (): boolean =>
  Boolean(
    document.getElementById('moobiedatNextLink') ||
      document.querySelector(
        '.moobiedat-page, .moobiedat-timer-box, #moobiedatReveal, .moobiedat-redirect-body',
      ) ||
      NEXT_RE.test(document.documentElement.innerHTML) ||
      NEXT_RE_ALT.test(document.documentElement.innerHTML),
  );

const absUrl = (href: string): string | null => {
  const cleaned = decodeHref(href);
  if (!cleaned || cleaned === '#' || /^javascript:/i.test(cleaned)) return null;
  try {
    return new URL(cleaned, location.href).href;
  } catch {
    return null;
  }
};

const nextFromDom = (): string | null => {
  const a = document.querySelector<HTMLAnchorElement>(NEXT_SEL);
  if (!a) return null;
  return absUrl(a.getAttribute('href') || a.href || '');
};

const nextFromHtml = (): string | null => {
  const html = document.documentElement?.innerHTML ?? '';
  if (!html) return null;
  const m = html.match(NEXT_RE) || html.match(NEXT_RE_ALT);
  if (!m?.[1]) return null;
  return absUrl(m[1]);
};

const nextHref = (): string | null => nextFromDom() || nextFromHtml();

const rememberAliasFromPage = (): void => {
  const fromQuery = nitrolinkAliasFromSearch(location.search);
  if (fromQuery) {
    void ensureNitrolinkChain(fromQuery, `https://${NITROLINK_HOSTS[0]}`);
  }
};

const rememberAliasFromHref = (href: string): void => {
  rememberAliasFromPage();
  try {
    const u = new URL(href);
    if (isNitrolinkShortenerHref(href)) {
      const alias = nitrolinkAliasFromPath(u.pathname);
      if (alias) void ensureNitrolinkChain(alias, u.origin);
      return;
    }
    const alias = nitrolinkAliasFromSearch(u.search);
    if (alias) void ensureNitrolinkChain(alias, `https://${NITROLINK_HOSTS[0]}`);
  } catch {}
};

const stripAdblockWall = (): void => {
  for (const el of document.querySelectorAll('body > div')) {
    const text = el.textContent || '';
    if (/disable your ad blocker/i.test(text)) el.remove();
  }
};

const goNext = (next: string, status: string): void => {
  if (started) return;
  started = true;
  requestVisibilitySpoof();
  stripAdblockWall();
  rememberAliasFromHref(next);
  const overlay = mountUi(status);
  overlay.setStatus(
    isNitrolinkShortenerHref(next) ? 'Opening your link…' : 'Moving to the next page…',
  );
  location.replace(next);
};

const coverIfGate = (): void => {
  if (!isMoobiedatGate()) return;
  stripAdblockWall();
  const stepInfo = parseStep();
  mountUi(
    stepInfo != null
      ? `Skipping step ${stepInfo.step} of ${stepInfo.total}…`
      : 'Getting things ready…',
  );
};

const runGate = (): void => {
  if (started) return;
  const next = nextHref();
  if (!next) return;
  const stepInfo = parseStep();
  goNext(
    next,
    stepInfo != null
      ? `Skipping step ${stepInfo.step} of ${stepInfo.total}…`
      : 'Moving to the next page…',
  );
};

const resumeFromChain = async (): Promise<void> => {
  if (started || resumeStarted || isMoobiedatGate()) return;
  if (nextHref()) return;
  resumeStarted = true;
  const chain = await readNitrolinkChain();
  if (!chain) {
    resumeStarted = false;
    return;
  }
  const overlay = mountUi('Returning to your short link…');
  overlay.setStatus('Returning to your short link…');
  started = true;
  requestVisibilitySpoof();
  location.replace(shortenerUrl(chain));
};

export function initNitrolinkMediator(): void {
  if (!isAllowedHost(NITROLINK_MEDIATOR_HOSTS)) return;
  if (hostnameMatches(location.hostname, NITROLINK_HOSTS)) return;

  const tick = (): void => {
    rememberAliasFromPage();
    coverIfGate();
    if (started) return;
    runGate();
    if (started) return;
    void resumeFromChain();
  };

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    tick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, {
    attributeFilter: ['href', 'class'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  let polls = 0;
  const poll = window.setInterval(() => {
    tick();
    if (started || ++polls >= 80) window.clearInterval(poll);
  }, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
