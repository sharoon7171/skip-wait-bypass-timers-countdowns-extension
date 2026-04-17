import { isAllowedHost } from '../utils/domain-check';

const ALLOWED_HOSTS = [
  'hdhub4u.catering',
  'hdhub4u.gd',
  'hdhub4u.gives',
  'hdhub4u.gs',
  'hdhub4u.hn',
  'hdhub4u.ht',
];

const hourlySeed = (): number => {
  const n = new Date();
  return n.getFullYear() * 1e6 + (n.getMonth() + 1) * 1e4 + n.getDate() * 100 + n.getHours() + 1;
};

export function initHdhub4uMainDomainRedirect(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  fetch(`https://cdn.hub4u.cloud/host/?v=${hourlySeed()}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { c?: string } | null) => {
      if (data?.c) {
        const url = atob(data.c);
        window.location.replace(url.split('?')[0] || url);
      }
    })
    .catch(() => {});
}
