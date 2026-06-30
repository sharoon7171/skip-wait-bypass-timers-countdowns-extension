import { isAllowedHost } from '../../utils/domain-check';

const LANDING_PAGE_HOSTS = [
  'hdhub4u.med',
  'hdhub4u.catering',
  'hdhub4u.gd',
  'hdhub4u.gives',
  'hdhub4u.glass',
  'hdhub4u.gs',
  'hdhub4u.hn',
  'hdhub4u.ht',
  'hdhub4u.insure',
] as const;

const MIRROR_HOST_LOOKUP_URL = 'https://cdn.hub4u.cloud/host/';

export function initHdhub4uLandingPageMed(): void {
  if (!isAllowedHost(LANDING_PAGE_HOSTS)) return;
  const d = new Date();
  const v = d.getFullYear() * 1e6 + (d.getMonth() + 1) * 1e4 + d.getDate() * 100 + d.getHours() + 1;
  void fetch(`${MIRROR_HOST_LOOKUP_URL}?v=${v}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { c?: string } | null) => {
      const encoded = data?.c;
      if (!encoded) return;
      const mirror = atob(encoded);
      location.replace(mirror.includes('?') ? mirror.slice(0, mirror.indexOf('?')) : mirror);
    })
    .catch(() => {});
}
