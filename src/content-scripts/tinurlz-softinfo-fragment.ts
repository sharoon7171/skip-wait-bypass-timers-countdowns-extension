import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'tinurlz-softinfo-fragment';
const KITOKOLA_HOST = 'kitokola.id';

function decodeFragment(raw: string): string | null {
  try {
    if (raw.startsWith('aHR0')) return atob(raw);
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function unwrapKitokola(inner: string): string | null {
  try {
    const u = new URL(inner);
    if (u.hostname.toLowerCase() !== KITOKOLA_HOST) return null;
    const dl = u.searchParams.get('dl') ?? u.searchParams.get('get');
    if (!dl) return null;
    const final = decodeURIComponent(dl);
    return /^https?:\/\//i.test(final) ? final : null;
  } catch {
    return null;
  }
}

export function initTinurlzSoftinfoFragment(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const raw = window.location.hash.slice(1);
  if (!raw) return;
  const inner = decodeFragment(raw);
  if (!inner || !/^https?:\/\//i.test(inner)) return;
  const finalUrl = unwrapKitokola(inner) ?? inner;
  window.location.replace(finalUrl);
}
