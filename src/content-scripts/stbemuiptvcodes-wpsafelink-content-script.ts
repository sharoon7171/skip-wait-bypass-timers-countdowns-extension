import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS = ['stbemuiptvcodes.com'];

type LandingPayload = { enableHumanVerification: string; go: string; token: string };

function applyLandingCookies(payload: LandingPayload): void {
  const exp = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
  document.cookie = `wpsafelink_go=${payload.go}; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_token=${payload.token}; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_pending=1; expires=${exp}; path=/`;
  document.cookie = `wpsl_gr_content_shown=1; expires=${exp}; path=/`;
  if (payload.enableHumanVerification === 'yes') {
    document.cookie = `enable_human_verification=yes; expires=${exp}; path=/`;
  }
}

function destinationFromGoB64(goB64: string): string | null {
  try {
    const decoded = atob(goB64);
    return /^https?:\/\//.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function parseLandingPayload(): LandingPayload | null {
  for (const script of document.scripts) {
    const t = script.textContent ?? '';
    const go = t.match(/var\s+go\s*=\s*"([A-Za-z0-9+/=]+)"/)?.[1];
    if (!go) continue;
    return {
      enableHumanVerification: t.match(/var\s+enableHumanVerification\s*=\s*"([^"]*)"/)?.[1] ?? '',
      go,
      token: t.match(/var\s+token\s*=\s*"([^"]*)"/)?.[1] ?? '',
    };
  }
  return null;
}

export function initStbemuiptvcodesWpsafelink(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    const payload = parseLandingPayload();
    if (!payload) return;
    applyLandingCookies(payload);
    const dest = destinationFromGoB64(payload.go);
    window.location.href = dest ?? `${window.location.origin}/`;
  });
}
