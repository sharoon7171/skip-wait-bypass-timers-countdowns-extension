import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';

const KEY = 'adlinkfly-token-payload';
const TOKEN_INPUT_SELECTOR = 'input[name="token"]';
const TOKEN_HTTP_B64_PREFIX = 'aHR0c';

let done = false;

function padBase64(s: string): string {
  const p = s.length % 4;
  return p ? s + '='.repeat(4 - p) : s;
}

function destinationUrlFromAdlinkflyTokenPayload(token: string): string | null {
  const idx = token.indexOf(TOKEN_HTTP_B64_PREFIX);
  if (idx === -1) return null;
  const normalized = token.slice(idx).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(padBase64(normalized));
    const decoded = new TextDecoder('utf-8').decode(
      Uint8Array.from(bin, (c) => c.charCodeAt(0)),
    );
    const match = decoded.match(/https?:\/\/[^\s\x00-\x1f"']+/);
    return match ? match[0].trim() : null;
  } catch {
    return null;
  }
}

function tryRedirect(): void {
  if (done) return;
  const input = document.querySelector<HTMLInputElement>(TOKEN_INPUT_SELECTOR);
  if (!input || !isCloudflareHumanVerificationDone(input.form ?? undefined)) return;
  const token = input.value?.trim();
  if (!token) return;
  const url = destinationUrlFromAdlinkflyTokenPayload(token);
  if (!url) return;
  done = true;
  window.location.replace(url);
}

function tick(): void {
  tryRedirect();
  if (!done) requestAnimationFrame(tick);
}

export function initAdlinkflyTokenPayloadRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const run = () => requestAnimationFrame(tick);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
}
