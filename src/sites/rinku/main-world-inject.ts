import { MSG_RINKU_PAGE_HOOKS, RINKU_LAND_HOSTS } from './hosts';
import { runRinkuPageHooks } from './page-hooks';

const rinkuTabs = new Set<number>();

const hostMatch = (h: string, d: string): boolean => h === d || h.endsWith('.' + d);

const isSeedUrl = (url: string): boolean => {
  const u = new URL(url);
  const h = u.hostname.toLowerCase();
  if (RINKU_LAND_HOSTS.some((d) => hostMatch(h, d))) return true;
  if (['7mb.io', 'rinku.pro', 'rinku.me'].some((d) => hostMatch(h, d))) return true;
  return /\/rinku\//i.test(u.pathname) || /\/backup\/w/i.test(u.pathname) || /redirect_to=random/i.test(u.search);
};

const inject = (tabId: number, frameId = 0): void => {
  void chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    injectImmediately: true,
    func: runRinkuPageHooks,
  });
};

export function initRinkuPageHooksInject(): void {
  chrome.tabs.onRemoved.addListener((tabId) => rinkuTabs.delete(tabId));

  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0 || !/^https?:/i.test(details.url)) return;
    const h = new URL(details.url).hostname.toLowerCase();
    if (hostMatch(h, 'google.com') || /\/bypass\.(php|html)$/i.test(new URL(details.url).pathname)) {
      rinkuTabs.delete(details.tabId);
      return;
    }
    if (isSeedUrl(details.url) || rinkuTabs.has(details.tabId)) {
      rinkuTabs.add(details.tabId);
      inject(details.tabId);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== MSG_RINKU_PAGE_HOOKS) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    rinkuTabs.add(tabId);
    inject(tabId, sender.frameId ?? 0);
    return false;
  });
}
