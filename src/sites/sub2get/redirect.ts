import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['sub2get.com'] as const;

function redirect(): void {
  const u = document.querySelector<HTMLAnchorElement>('#butunlock a')?.href;
  if (u) location.replace(u);
}

export function initSub2getRedirect(): void {
  if (!isAllowedHost(HOSTS) || !/[?&]l=/.test(location.search)) return;
  whenDomParsed(redirect);
}
