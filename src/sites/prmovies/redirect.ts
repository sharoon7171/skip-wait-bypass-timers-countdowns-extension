import { isAllowedHost } from '../../utils/domain-check';

const HOSTS = ['prmovies.mba'] as const;

export function initPrmoviesRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  void fetch(`https://rep.prmovies3.online/api/get?v=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((d: { response?: string }) => d.response && location.replace(atob(d.response)));
}
