const injected = new Set<string>();

function forgetTab(tabId: number): void {
  for (const k of injected) {
    if (k.startsWith(`${tabId}:`)) injected.delete(k);
  }
}

export function initCoomeetMainWorldInject(): void {
  chrome.tabs.onRemoved.addListener(forgetTab);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'SKIP_WAIT_COOMEET_MAIN') return false;
    const tabId = sender.tab?.id;
    const frameId = sender.frameId;
    if (tabId === undefined || frameId === undefined) {
      sendResponse({ ok: false });
      return false;
    }
    const key = `${tabId}:${frameId}`;
    if (injected.has(key)) {
      sendResponse({ ok: true, skipped: true });
      return false;
    }
    chrome.scripting
      .executeScript({
        target: { tabId, frameIds: [frameId] },
        world: 'MAIN',
        files: ['content.js'],
      })
      .then(() => {
        injected.add(key);
        sendResponse({ ok: true });
      })
      .catch(() => {
        sendResponse({ ok: false });
      });
    return true;
  });
}
