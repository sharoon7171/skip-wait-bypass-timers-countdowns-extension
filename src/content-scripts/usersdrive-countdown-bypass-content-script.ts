import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';
import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS = ['usersdrive.com'];

let firstPostCommitted = false;
let secondClickCommitted = false;
let overrideRaf = 0;

function hasTurnstileWidget(): boolean {
  return document.querySelector('.cf-turnstile') !== null;
}

function unlockDownloadUi(): void {
  const btn = document.getElementById('downloadbtn');
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = false;
    btn.removeAttribute('disabled');
    btn.classList.remove('disabled');
  }
  const el = document.getElementById('countdown');
  if (el) {
    el.setAttribute('style', 'visibility:hidden');
    el.closest('.countdown')?.setAttribute('style', 'display:none');
  }
}

function forceCountdownZero(): void {
  const sec = document.querySelector('#countdown .seconds');
  if (sec) sec.textContent = '0';
}

function startCountdownOverride(): void {
  const step = (): void => {
    if (firstPostCommitted) return;
    forceCountdownZero();
    unlockDownloadUi();
    overrideRaf = requestAnimationFrame(step);
  };
  overrideRaf = requestAnimationFrame(step);
}

function getDownloadForm(): HTMLFormElement | null {
  const btn = document.getElementById('downloadbtn');
  return btn instanceof HTMLButtonElement ? (btn.form ?? null) : null;
}

function runWhenCloudflareAllowsFirstPost(onReady: () => void): void {
  const maybeRun = (): boolean => {
    if (!getDownloadForm()) return false;
    if (hasTurnstileWidget() && !isCloudflareHumanVerificationDone()) return false;
    onReady();
    return true;
  };
  if (maybeRun()) return;
  const mo = new MutationObserver(() => {
    if (maybeRun()) mo.disconnect();
  });
  mo.observe(document.documentElement, {
    attributeFilter: ['value', 'class'],
    attributes: true,
    childList: true,
    subtree: true,
  });
}

function findPostDownloadAnchor(): HTMLAnchorElement | null {
  for (const a of document.querySelectorAll('a[href]')) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    const t = a.textContent?.trim() ?? '';
    if (/click\s*to\s*download/i.test(t)) return a;
  }
  const byHref = document.querySelector<HTMLAnchorElement>('a[href*="op=download"]');
  if (byHref) return byHref;
  return null;
}

function runSecondStepClick(): void {
  const tryClick = (): boolean => {
    if (secondClickCommitted) return true;
    const a = findPostDownloadAnchor();
    if (!a) return false;
    secondClickCommitted = true;
    a.click();
    return true;
  };
  if (tryClick()) return;
  const mo = new MutationObserver(() => {
    if (tryClick()) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

export function initUsersdriveAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    const start = (): void => {
      if (document.getElementById('downloadbtn')) {
        startCountdownOverride();
        runWhenCloudflareAllowsFirstPost(() => {
          if (firstPostCommitted) return;
          firstPostCommitted = true;
          cancelAnimationFrame(overrideRaf);
          forceCountdownZero();
          unlockDownloadUi();
          getDownloadForm()?.submit();
        });
        return;
      }
      runSecondStepClick();
    };
    start();
  });
}
