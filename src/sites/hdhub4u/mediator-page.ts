import { isAllowedHost } from '../../utils/domain-check';

const MEDIATOR_PAGE_HOSTS = [
  'cryptoinsights.site',
  'cryptonewz.one',
  'gadgetsweb.xyz',
  'greenmountmotors.com',
  'inventoryidea.com',
  'taazabull24.com',
  'techmirror.click',
] as const;

const MEDIATOR_DESTINATION_STORAGE_KEY = 'o';

const mediatorCipherDecode = (s: string): string =>
  s.replace(/[a-zA-Z]/g, (c) => {
    const n = c.charCodeAt(0);
    return String.fromCharCode(n >= 97 ? ((n - 84) % 26) + 97 : ((n - 52) % 26) + 65);
  });

function readMediatorStorageValue(): string | null {
  const raw = localStorage.getItem(MEDIATOR_DESTINATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const { value, expiry } = JSON.parse(raw) as { value: string; expiry: number };
    if (Date.now() > expiry) {
      localStorage.removeItem(MEDIATOR_DESTINATION_STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function decodeMediatorDestination(encoded: string): string | null {
  try {
    const payload = atob(mediatorCipherDecode(atob(atob(encoded))));
    const { o } = JSON.parse(payload) as { o?: string };
    return o ? atob(o) : null;
  } catch {
    return null;
  }
}

export function initHdhub4uMediatorPage(): void {
  if (!isAllowedHost(MEDIATOR_PAGE_HOSTS)) return;
  if (!location.pathname.includes('/homelander')) return;
  const redirect = (): boolean => {
    const encoded = readMediatorStorageValue();
    if (!encoded) return false;
    const destination = decodeMediatorDestination(encoded);
    if (!destination || !/^https?:\/\//i.test(destination)) return false;
    location.replace(destination);
    return true;
  };
  if (redirect()) return;
  const id = setInterval(() => {
    if (redirect()) clearInterval(id);
  }, 50);
}
