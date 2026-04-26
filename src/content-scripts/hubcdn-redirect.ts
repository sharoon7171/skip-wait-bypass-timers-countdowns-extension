import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'hubcdn-redirect';
const DL_LINK_RE = /\/dl\/\?link=(.+)/;

export function initHubcdnRedirect(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const m = window.location.href.match(DL_LINK_RE);
  if (m?.[1]) window.location.href = decodeURIComponent(m[1]);
}
