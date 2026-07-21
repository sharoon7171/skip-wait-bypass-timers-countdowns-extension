import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { buildFullPageOverlayCss, overlayActiveClass } from '../../injected-ui/overlay-styles';
import { hostnameMatches, isAllowedHost } from '../../utils/domain-check';
import {
  isArolinksShortenerHref,
  msUntilUnlockReady,
  readArolinksChain,
  shortenerUrl,
  type ArolinksChain,
} from './chain';
import {
  AROLINKS_GATE_COOKIE,
  AROLINKS_GATE_COOKIE_NAMES,
  AROLINKS_HOSTS,
  AROLINKS_MEDIATOR_HOSTS,
} from './hosts';

const OVERLAY_ID = 'skip-wait-arolinks-mediator';
const BOOT_STYLE_ID = 'skip-wait-arolinks-mediator-boot';
const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: 'Skip Wait is handling the waiting pages for you.',
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

const seedGateCookies = (): void => {
  for (const name of AROLINKS_GATE_COOKIE_NAMES) {
    document.cookie = `${name}=${AROLINKS_GATE_COOKIE}; path=/; max-age=7200; SameSite=Lax`;
  }
};

const isBtn7Gate = (): boolean => Boolean(document.getElementById('btn7'));

const isLearnMoreGate = (): boolean =>
  Boolean(
    document.getElementById('tp-snp2') &&
      document.querySelector('a[href*="learn_more.php"]'),
  );

const isArticleGate = (): boolean => isBtn7Gate() || isLearnMoreGate();

const continueEndpoint = (): string | null => {
  if (isBtn7Gate()) return new URL('/readmore/', location.origin).href;
  if (isLearnMoreGate()) {
    const learn = document.querySelector<HTMLAnchorElement>(
      'a[href*="learn_more.php"]',
    );
    return learn?.href ?? null;
  }
  return null;
};

const jsRedirectTarget = (html: string, base: string): string | null => {
  const m = html.match(
    /(?:document|window)\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/,
  );
  if (!m?.[1]) return null;
  try {
    return new URL(m[1], base).href;
  } catch {
    return null;
  }
};

const goShortener = async (chain: ArolinksChain, overlay: FullPageOverlay): Promise<void> => {
  const waitMs = msUntilUnlockReady(chain);
  if (waitMs > 0) {
    overlay.setStatus('Almost ready…');
    overlay.startCountdown(Date.now() + waitMs);
    await sleep(waitMs);
    overlay.hideCountdown();
  }
  overlay.setStatus('Opening your link…');
  location.replace(shortenerUrl(chain));
};

const coverIfGate = (): void => {
  if (!isArticleGate()) return;
  mountUi('Getting things ready…');
};

const runArticle = async (): Promise<void> => {
  if (started || !isArticleGate()) return;
  started = true;
  requestVisibilitySpoof();
  seedGateCookies();
  const overlay = mountUi('Getting things ready…');

  const chain = await readArolinksChain();
  if (!chain) {
    overlay.setStatus('Open your original link again to continue.');
    started = false;
    return;
  }

  const endpoint = continueEndpoint();
  if (!endpoint) {
    overlay.setStatus('This page isn’t ready yet. Reload and try again.');
    started = false;
    return;
  }

  overlay.setStatus('Moving to the next page…');
  let html = '';
  try {
    const r = await fetch(endpoint, {
      credentials: 'include',
      redirect: 'follow',
      headers: { Accept: 'text/html', Referer: location.href },
    });
    html = await r.text();
  } catch {
    overlay.setStatus('Couldn’t continue. Reload and try again.');
    started = false;
    return;
  }

  const next = jsRedirectTarget(html, endpoint);
  if (!next) {
    overlay.setStatus('Couldn’t continue. Reload and try again.');
    started = false;
    return;
  }

  if (isArolinksShortenerHref(next)) {
    await goShortener(chain, overlay);
    return;
  }

  overlay.setStatus('Moving to the next page…');
  location.replace(next);
};

export function initArolinksMediator(): void {
  if (!isAllowedHost(AROLINKS_MEDIATOR_HOSTS)) return;
  if (hostnameMatches(location.hostname, AROLINKS_HOSTS)) return;

  const tick = (): void => {
    coverIfGate();
    if (started) return;
    if (!isArticleGate()) return;
    void runArticle();
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
