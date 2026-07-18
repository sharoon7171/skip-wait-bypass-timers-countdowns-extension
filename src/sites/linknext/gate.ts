import { createFullPageOverlay, type FullPageOverlay } from '../../injected-ui/full-page-overlay';
import { overlayActiveClass, buildFullPageOverlayCss } from '../../injected-ui/overlay-styles';
import { isLinknextPipelinePage, linknextPhase } from './match';
import {
  BLOG_STEP_MS,
  BLOG_STEPS,
  blogSsid,
  counterSecFromPage,
  csrfFromMeta,
  fetchIpv4,
  linknextAliasRedirectTarget,
  linksGoForm,
  mediatorCsrfToken,
  mediatorPatchWithConflictClear,
  mediatorSsid,
  patchSessionIncrement,
  postLinksGo,
  type IncrementHit,
} from './unlock';

const OVERLAY_ID = 'skip-wait-linknext-overlay';
const BOOT_STYLE_ID = 'skip-wait-linknext-boot';

const NOTE = {
  lead: 'Hang tight — unlocking your link.',
  detail: "You don't need to tap anything on the page.",
} as const;

let ui: FullPageOverlay | null = null;
let started = false;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const requestVisibilitySpoof = (): Promise<void> =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }, () => resolve());
  });

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

const waitFor = async <T>(pick: () => T | null | false | undefined, ms: number): Promise<T> => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = pick();
    if (v) return v;
    await sleep(100);
  }
  throw new Error('wait timeout');
};

const countdownWait = async (overlay: FullPageOverlay, ms: number, status: string): Promise<void> => {
  overlay.setStatus(status);
  overlay.startCountdown(Date.now() + ms);
  await sleep(ms);
  overlay.hideCountdown();
};

const fail = (overlay: FullPageOverlay): void => {
  overlay.setError('Unlock failed. Reload and try again.');
};

const stepStatus = (step: number, total: number, text: string): string =>
  `Step ${step} of ${total} — ${text}`;

async function runAlias(overlay: FullPageOverlay): Promise<void> {
  await requestVisibilitySpoof();
  overlay.setStatus('Opening gate…');
  location.replace(await linknextAliasRedirectTarget());
}

async function runMediator(overlay: FullPageOverlay): Promise<void> {
  await requestVisibilitySpoof();
  const ssid = await waitFor(() => mediatorSsid(), 20_000);
  await waitFor(() => mediatorCsrfToken(), 15_000);
  overlay.setStatus(stepStatus(1, 1, 'Starting session…'));
  const redirect = await mediatorPatchWithConflictClear(ssid, await fetchIpv4());
  overlay.setStatus(stepStatus(1, 1, 'Continuing…'));
  location.replace(redirect);
}

const sessionIncrement = async (
  overlay: FullPageOverlay,
  ssid: string,
  token: string,
  step: number,
): Promise<IncrementHit> => {
  for (;;) {
    const hit = await patchSessionIncrement(ssid, token);
    if (hit.ok) return hit;
    if (hit.rateLimited) {
      await countdownWait(overlay, BLOG_STEP_MS, stepStatus(step, BLOG_STEPS, 'Waiting for server timer…'));
      continue;
    }
    throw new Error('increment failed');
  }
};

async function runBlog(overlay: FullPageOverlay): Promise<void> {
  await requestVisibilitySpoof();
  const ssid = await waitFor(() => blogSsid(), 25_000);
  const token = await waitFor(() => csrfFromMeta(), 15_000);

  for (let step = 0; step < BLOG_STEPS; step++) {
    const n = step + 1;
    if (step > 0) await countdownWait(overlay, BLOG_STEP_MS, stepStatus(n, BLOG_STEPS, 'Waiting for server timer…'));
    else overlay.setStatus(stepStatus(n, BLOG_STEPS, 'Advancing unlock…'));

    const hit = await sessionIncrement(overlay, ssid, token, n);
    if (hit.completed && hit.finalDestination) {
      overlay.setStatus(stepStatus(n, BLOG_STEPS, 'Opening destination gate…'));
      location.replace(hit.finalDestination);
      return;
    }
  }
  throw new Error('blog incomplete');
}

async function runTkGate(overlay: FullPageOverlay): Promise<void> {
  await requestVisibilitySpoof();
  const form = await waitFor(() => linksGoForm(), 20_000);
  await countdownWait(overlay, counterSecFromPage() * 1000, 'Waiting for unlock timer…');
  overlay.setStatus('Opening destination…');
  location.replace(await postLinksGo(form, location.href));
}

async function runUnlock(): Promise<void> {
  const overlay = mountUi();
  try {
    switch (linknextPhase()) {
      case 'alias':
        await runAlias(overlay);
        return;
      case 'mediator':
        await runMediator(overlay);
        return;
      case 'tk':
        await runTkGate(overlay);
        return;
      case 'blog':
        await runBlog(overlay);
        return;
      default:
        throw new Error('unknown phase');
    }
  } catch {
    fail(overlay);
  }
}

const kickUnlock = (): void => {
  if (started || !isLinknextPipelinePage()) return;
  started = true;
  void runUnlock();
};

export function initLinknextGate(): void {
  if (!isLinknextPipelinePage()) return;

  const phase = linknextPhase();

  const start = (): void => {
    bootOverlayLock();
    mountUi();
    kickUnlock();
  };

  if (phase === 'alias' || phase === 'mediator') {
    start();
    return;
  }

  if (phase === 'blog') {
    const tryBlog = (): void => {
      if (started) return;
      if (!document.body && document.readyState === 'loading') return;
      if (!blogSsid()) return;
      start();
    };

    tryBlog();
    if (started) return;

    const mo = new MutationObserver(() => {
      tryBlog();
      if (started) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { tryBlog(); mo.disconnect(); }, { once: true });
    return;
  }

  const tryBody = (): void => {
    if (!document.body && document.readyState === 'loading') return;
    start();
  };

  bootOverlayLock();
  mountUi();

  tryBody();
  if (started) return;

  const mo = new MutationObserver(() => {
    tryBody();
    if (started) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { tryBody(); mo.disconnect(); }, { once: true });
}
