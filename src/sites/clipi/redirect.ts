import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['clipi.cc'] as const;
const RE = /var\s+longUrl\s*=\s*["']([^"']+)["']/;

function redirect(): void {
  const m = RE.exec(document.documentElement.innerHTML);
  if (!m?.[1]) return;
  const u = m[1].replace(/\\\//g, '/');
  location.replace(/^https?:\/\//i.test(u) ? u : `http://${u}`);
}

export function initClipiRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(redirect);
}
