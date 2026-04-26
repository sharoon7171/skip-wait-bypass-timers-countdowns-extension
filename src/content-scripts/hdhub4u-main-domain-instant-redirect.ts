import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'hdhub4u-main-domain';

const hourlySeed = (): number => {
  const n = new Date();
  return n.getFullYear() * 1e6 + (n.getMonth() + 1) * 1e4 + n.getDate() * 100 + n.getHours() + 1;
};

export function initHdhub4uMainDomainRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
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
