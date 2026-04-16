export const MSG_INJECT_VISIBILITY_SPOOF = 'INJECT_VISIBILITY_SPOOF' as const;

export function runDocumentVisibilitySpoof(): void {
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true,
    });
    Object.defineProperty(Document.prototype, 'hasFocus', {
      value: () => true,
      configurable: true,
      writable: true,
    });
  } catch {}
}

const XDM_INTERSTITIAL = /^\/(?:r|download)\/[^/]+/;

export function initDocumentVisibilitySpoof(): void {
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'loading') return;
    const raw = tab.url || tab.pendingUrl;
    if (!raw || !URL.canParse(raw)) return;
    if (!XDM_INTERSTITIAL.test(new URL(raw).pathname)) return;
    void chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      injectImmediately: true,
      func: runDocumentVisibilitySpoof,
    });
  });

  chrome.runtime.onMessage.addListener(
    (msg: { type?: string }, sender, sendResponse) => {
      if (msg?.type !== MSG_INJECT_VISIBILITY_SPOOF || !sender.tab?.id) {
        sendResponse();
        return;
      }
      chrome.scripting
        .executeScript({
          target: { tabId: sender.tab.id },
          func: runDocumentVisibilitySpoof,
          world: 'MAIN',
          injectImmediately: true,
        })
        .then(sendResponse)
        .catch(sendResponse);
      return true;
    }
  );
}
