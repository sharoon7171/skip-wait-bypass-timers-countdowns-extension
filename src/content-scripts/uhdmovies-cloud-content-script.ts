import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS = ['cloud.unblockedgames.world'] as const;
const GO_PEPE = /\?go=(pepe-[a-f0-9]+)/;
const SID_KEY = 'skipwait_cug_sid';

function armSidFromQuery(): void {
  try {
    if (new URLSearchParams(window.location.search).has('sid')) {
      sessionStorage.setItem(SID_KEY, '1');
    }
  } catch {}
}

function sidSessionValid(): boolean {
  try {
    return Boolean(sessionStorage.getItem(SID_KEY));
  } catch {
    return false;
  }
}

function trySubmitLanding(): boolean {
  const el = document.getElementById('landing');
  if (!(el instanceof HTMLFormElement) || el.method.toLowerCase() !== 'post') return false;
  if (!el.querySelector('input[name="_wp_http2"]') || !el.querySelector('input[name="token"]')) return false;
  const action = el.action;
  if (!action || !/^https?:\/\//i.test(action)) return false;
  el.submit();
  return true;
}

function tryAssignGoPepe(): boolean {
  if (!document.getElementById('verify_button2')) return false;
  const id = (document.documentElement?.innerHTML ?? '').match(GO_PEPE)?.[1];
  if (!id) return false;
  const next = `${window.location.origin}/?go=${id}`;
  if (window.location.href.split('#')[0] === next) return false;
  window.location.assign(next);
  return true;
}

function tryAutomate(): boolean {
  return trySubmitLanding() || tryAssignGoPepe();
}

export function initUhdmoviesCloudContentScript(): void {
  if (!isAllowedHost(HOSTS)) return;
  armSidFromQuery();
  if (!sidSessionValid()) return;
  let done = false;
  const run = (): void => {
    if (done) return;
    if (tryAutomate()) {
      done = true;
      return;
    }
    const mo = new MutationObserver(() => {
      if (done) return;
      if (tryAutomate()) {
        done = true;
        mo.disconnect();
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  };
  whenDomParsed(run);
}
