import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['clipi.cc'] as const;
const RE = /var\s+longUrl\s*=\s*["']([^"']+)["']/;

const urlFrom = (s: string): string | undefined =>
  s.match(RE)?.[1]?.replace(/\\\//g, '/');

export function initClipiRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  const fromPage = [...document.scripts].map((s) => s.textContent ?? '').join('');
  const u = urlFrom(fromPage);
  if (u) return void window.location.replace(u);
  fetch(window.location.href)
    .then((r) => r.text())
    .then((h) => { const u = urlFrom(h); u && window.location.replace(u); })
    .catch(() => {});
}
