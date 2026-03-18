import { isAllowedHost } from '../utils/domain-check';
import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';

const HOSTS = ['tpi.li', 'shrinkearn.com', 'oil.la'];
const FORM_SELECTOR = 'form[action*="advertisingcamps.com"]';
const TOKEN_B64_PREFIX = 'aHR0c';

let done = false;

function getFinalUrlFromToken(token: string): string | null {
  const idx = token.indexOf(TOKEN_B64_PREFIX);
  if (idx === -1) return null;
  try {
    const m = atob(token.slice(idx)).match(/https?:\/\/[^\s\x00-\x1f"']+/);
    return m ? m[0].trim() : null;
  } catch {
    return null;
  }
}

function tryRedirect(): void {
  if (done || !isAllowedHost(HOSTS)) return;
  const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);
  if (!form || !isCloudflareHumanVerificationDone(form)) return;
  const url = getFinalUrlFromToken(form.querySelector<HTMLInputElement>('input[name="token"]')?.value?.trim() ?? '');
  if (!url) return;
  done = true;
  window.location.href = url;
}

function tick(): void {
  tryRedirect();
  if (!done) requestAnimationFrame(tick);
}

export function initShrinkearnRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  const run = () => requestAnimationFrame(tick);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
}
