import { hostnameMatches } from '../../utils/domain-check';

export const LOOT_HOSTS = ['speedy-links.com', 'best-links.org', 'free-leaks.com'] as const;
export const LOOT_PATH_RE = /^\/s(?:\/|\?)/i;

const lootPath = (pathname: string, search: string) => LOOT_PATH_RE.test(`${pathname}${search}`);

export function isLootLockerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return hostnameMatches(u.hostname, LOOT_HOSTS) && lootPath(u.pathname, u.search);
  } catch {
    return false;
  }
}

export function isLootLockerPage(): boolean {
  if (!hostnameMatches(location.hostname, LOOT_HOSTS) || !lootPath(location.pathname, location.search)) {
    return false;
  }
  return [...document.scripts].some((s) => /WrappedBotd|\/\d+\.js(?:\?|$)/.test(s.src));
}
