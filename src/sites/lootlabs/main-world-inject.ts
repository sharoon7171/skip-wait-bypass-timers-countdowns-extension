import { isLootLockerUrl } from './locker';
import { LOOT_MSG_SOURCE, MSG_INJECT_LOOT, runLootBootstrap } from './main-world-hook';

const inject = (tabId: number, frameId: number, earlyOnly: boolean) => {
  void chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: 'MAIN',
    injectImmediately: true,
    func: runLootBootstrap,
    args: [LOOT_MSG_SOURCE, earlyOnly],
  });
};

export function initLootlabsMainWorldInject(): void {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0 || !isLootLockerUrl(details.url)) return;
    inject(details.tabId, 0, true);
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== MSG_INJECT_LOOT) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    inject(tabId, sender.frameId ?? 0, false);
    return false;
  });
}
