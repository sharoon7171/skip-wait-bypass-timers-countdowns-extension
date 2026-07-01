import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { showWpSafelinkRedirectOverlay } from './redirect';

const HOSTS = ['stbemuiptvcodes.com'] as const;
const GO_RE = /var\s+go\s*=\s*"([A-Za-z0-9+/=]+)"/;
const TOKEN_RE = /var\s+token\s*=\s*"([^"]*)"/;
const VERIFY_RE = /var\s+enableHumanVerification\s*=\s*"([^"]*)"/;

type LandingPayload = { go: string; token: string; verify: string };

const parseLanding = (): LandingPayload | null => {
  for (const { textContent: t = '' } of document.scripts) {
    const go = t.match(GO_RE)?.[1];
    if (!go) continue;
    return { go, token: t.match(TOKEN_RE)?.[1] ?? '', verify: t.match(VERIFY_RE)?.[1] ?? '' };
  }
  return null;
};

const setCookies = ({ go, token, verify }: LandingPayload): void => {
  const exp = new Date(Date.now() + 600_000).toUTCString();
  const set = (name: string, value: string) => {
    document.cookie = `${name}=${value}; expires=${exp}; path=/`;
  };
  set('wpsafelink_go', go);
  set('wpsl_gr_token', token);
  set('wpsl_gr_pending', '1');
  set('wpsl_gr_content_shown', '1');
  if (verify === 'yes') set('enable_human_verification', 'yes');
};

const destFromGo = (go: string): string => {
  try {
    const url = atob(go);
    if (/^https?:\/\//.test(url)) return url;
  } catch {}
  return location.origin;
};

export function initStbemuiptvcodesWpsafelink(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    const payload = parseLanding();
    if (!payload) return;
    showWpSafelinkRedirectOverlay();
    setCookies(payload);
    location.href = destFromGo(payload.go);
  });
}
