import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'hdhub4u-timer-bypass';

type StrProto = string & { ca(): string; de(): string; en(): string };

const extendString = (): void => {
  (String.prototype as unknown as { ca: () => string }).ca = function (this: string) {
    return this.replace(/[a-zA-Z]/g, (c) => {
      const n = c.charCodeAt(0);
      return String.fromCharCode(n >= 97 ? (n - 84) % 26 + 97 : (n - 52) % 26 + 65);
    });
  };
  (String.prototype as unknown as { de: () => string }).de = function (this: string) { return atob(this); };
  (String.prototype as unknown as { en: () => string }).en = function (this: string) { return btoa(this); };
};

function getStorageData(key: string): string | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as { value: string; expiry: number };
    if (Date.now() > p.expiry) {
      window.localStorage.removeItem(key);
      return null;
    }
    return p.value;
  } catch {
    return null;
  }
}

function extractFinalUrl(): string | null {
  const encoded = getStorageData('o');
  if (!encoded) return null;
  try {
    const s = encoded as unknown as StrProto;
    const decoded = (((s.de() as StrProto).de() as StrProto).ca() as StrProto).de();
    const obj = JSON.parse(decoded) as { o?: string };
    return obj.o ? atob(obj.o) : null;
  } catch {
    return null;
  }
}

export function initHdhub4uTimerBypass(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  extendString();
  const check = (): void => {
    const url = extractFinalUrl();
    if (url) window.location.href = url;
    else requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
