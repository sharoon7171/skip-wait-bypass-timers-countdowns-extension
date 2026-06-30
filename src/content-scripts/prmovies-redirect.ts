import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['prmovies.mba'] as const;
const API_URL = 'https://rep.prmovies3.online/api/get';

export function initPrmoviesRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  fetch(`${API_URL}?v=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((data: { key?: string } | null) => {
      if (data?.key) window.location.href = `https://${atob(data.key)}`;
    })
    .catch(() => {});
}
