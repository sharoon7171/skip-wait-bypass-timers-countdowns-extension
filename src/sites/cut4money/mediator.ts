import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { hostnameMatches, isAllowedHost } from '../../utils/domain-check';
import {
  cut4moneyAliasFromCookie,
  cut4moneyAliasFromHref,
  cut4moneyOriginFromHref,
  ensureCut4moneyChain,
  isCut4moneyShortenerHref,
  readCut4moneyChain,
  shortenerUrl,
} from './chain';
import { CUT4MONEY_HOSTS, CUT4MONEY_MEDIATOR_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-cut4money-mediator';
const BOOT_STYLE_ID = 'skip-wait-cut4money-mediator-boot';
const GO_SEL = '#go_d';
const SKIP_ACTION_RE = /^page_skip5(?:_(\d+))?$/i;

let ui: FullPageOverlay | null = null;
let started = false;
let resumeStarted = false;
let rememberedAlias: string | null = null;
let tickQueued = false;
let resumeArmed = false;

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

const absUrl = (href: string): string | null => {
  const cleaned = decodeHref(href);
  if (!cleaned || cleaned === '#' || /^javascript:/i.test(cleaned)) return null;
  try {
    return new URL(cleaned, location.href).href;
  } catch {
    return null;
  }
};

const b64Json = (raw: string): unknown => {
  try {
    const s = decodeURIComponent(raw);
    const pad = '='.repeat((4 - (s.length % 4)) % 4);
    return JSON.parse(atob(s + pad)) as unknown;
  } catch {
    return null;
  }
};

const parseSkipStep = (href: string): { step: number; total: number } | null => {
  try {
    const token = new URL(href).searchParams.get('token');
    if (!token) return null;
    const top = b64Json(token);
    if (!Array.isArray(top) || typeof top[0] !== 'string') return null;
    const m = SKIP_ACTION_RE.exec(top[0]);
    if (!m) return null;
    const step = m[1] ? parseInt(m[1], 10) : 1;
    let depth = 1;
    let cur: unknown = top;
    while (Array.isArray(cur) && typeof cur[2] === 'string') {
      cur = b64Json(cur[2]);
      depth += 1;
    }
    const total = step + depth - 1;
    if (!Number.isFinite(step) || step < 1 || total < step) return null;
    return { step, total };
  } catch {
    return null;
  }
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

const mountUi = (status = 'Getting things ready…', next: string | null = null): FullPageOverlay => {
  bootOverlayLock();
  const stepInfo = next ? parseSkipStep(next) : null;
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

const nextHref = (): string | null => {
  const a = document.querySelector<HTMLAnchorElement>(GO_SEL);
  if (!a) return null;
  return absUrl(a.getAttribute('href') || a.href || '');
};

const aliasFromTokenHref = (href: string): { alias: string; origin: string } | null => {
  const direct = cut4moneyAliasFromHref(href);
  const directOrigin = cut4moneyOriginFromHref(href);
  if (direct && directOrigin) return { alias: direct, origin: directOrigin };
  try {
    let token = new URL(href).searchParams.get('token');
    while (token) {
      const top = b64Json(token);
      if (!Array.isArray(top)) break;
      if (typeof top[1] === 'string') {
        const alias = cut4moneyAliasFromHref(top[1]);
        const origin = cut4moneyOriginFromHref(top[1]);
        if (alias && origin) return { alias, origin };
      }
      token = typeof top[2] === 'string' ? top[2] : null;
    }
  } catch {}
  return null;
};

const rememberAlias = (href?: string): void => {
  const fromHref = href ? aliasFromTokenHref(href) : null;
  if (fromHref) {
    if (rememberedAlias === fromHref.alias) return;
    rememberedAlias = fromHref.alias;
    void ensureCut4moneyChain(fromHref.alias, fromHref.origin);
    return;
  }
  const alias = cut4moneyAliasFromCookie();
  if (!alias || rememberedAlias === alias) return;
  rememberedAlias = alias;
  void ensureCut4moneyChain(alias, `https://${CUT4MONEY_HOSTS[0]}`);
};

const goNext = (next: string): void => {
  if (started) return;
  started = true;
  requestVisibilitySpoof();
  rememberAlias(next);
  const stepInfo = parseSkipStep(next);
  const overlay = mountUi(
    stepInfo != null
      ? `Skipping step ${stepInfo.step} of ${stepInfo.total}…`
      : 'Moving to the next page…',
    next,
  );
  overlay.setStatus(
    isCut4moneyShortenerHref(next) ? 'Opening your link…' : 'Moving to the next page…',
  );
  location.replace(next);
};

const resumeFromChain = async (): Promise<void> => {
  if (!resumeArmed || started || resumeStarted) return;
  if (nextHref() || document.querySelector(GO_SEL)) return;
  resumeStarted = true;
  const chain = await readCut4moneyChain();
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

const tick = (): void => {
  if (started) return;
  const next = nextHref();
  if (next) {
    goNext(next);
    return;
  }
  void resumeFromChain();
};

const queueTick = (): void => {
  if (started || tickQueued) return;
  tickQueued = true;
  queueMicrotask(() => {
    tickQueued = false;
    tick();
  });
};

export function initCut4moneyMediator(): void {
  if (!isAllowedHost(CUT4MONEY_MEDIATOR_HOSTS)) return;
  if (hostnameMatches(location.hostname, CUT4MONEY_HOSTS)) return;

  tick();
  if (started) return;

  const mo = new MutationObserver(() => {
    queueTick();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, {
    attributeFilter: ['href'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  let polls = 0;
  const poll = window.setInterval(() => {
    if (polls >= 10) resumeArmed = true;
    tick();
    if (started || ++polls >= 120) window.clearInterval(poll);
  }, 200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, true);
  }
  window.addEventListener('load', tick, true);
}
