import { isAllowedHost } from '../utils/domain-check';
import { getSafelinkRedirectUrl } from './wp-safelink-redirect-content-script';

const HOST = 'stbemuiptvcodes.com';

type LandingPayload = { go: string; token: string; enableHumanVerification: string };

function parseLandingPayload(): LandingPayload | null {
  for (const script of document.scripts) {
    const t = script.textContent ?? '';
    const gm = t.match(/var\s+go\s*=\s*"([A-Za-z0-9+/=]+)"/);
    if (!gm?.[1]) continue;
    return {
      go: gm[1],
      token: t.match(/var\s+token\s*=\s*"([^"]*)"/)?.[1] ?? '',
      enableHumanVerification: t.match(/var\s+enableHumanVerification\s*=\s*"([^"]*)"/)?.[1] ?? '',
    };
  }
  return null;
}

function applyLandingCookies(payload: LandingPayload): boolean {
  const d = new Date();
  d.setTime(d.getTime() + 10 * 60 * 1000);
  const exp = d.toUTCString();
  document.cookie = `wpsafelink_go=${payload.go}; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_token=${payload.token}; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_pending=1; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_content_shown=1; expires=${exp}; path=/`;
  if (payload.enableHumanVerification === 'yes') {
    document.cookie = `enable_human_verification=${payload.enableHumanVerification}; expires=${exp}; path=/`;
  }
  return document.cookie.includes('wpsafelink_go=');
}

function destinationFromGoB64(goB64: string): string | null {
  try {
    const decoded = atob(goB64);
    if (/^https?:\/\//.test(decoded)) return decoded;
  } catch {
    return null;
  }
  return null;
}

export function initStbemuiptvcodesWpsafelink(): void {
  if (!isAllowedHost([HOST])) return;
  const run = (): void => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('wpsafelink')) {
      const payload = parseLandingPayload();
      if (!payload) return;
      if (!applyLandingCookies(payload)) return;
      const dest = destinationFromGoB64(payload.go);
      window.location.href = dest ?? `https://${HOST}/`;
      return;
    }
    const url = getSafelinkRedirectUrl();
    if (url) window.location.href = url;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
