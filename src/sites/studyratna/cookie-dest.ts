import { redeemUrlFromProlinkCookie } from './decode-dest';
import { STUDYRATNA_GET_DEST } from './hosts';

function readDest(pageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url: pageUrl }, (cookies) => {
      if (chrome.runtime.lastError || !cookies?.length) {
        resolve(null);
        return;
      }
      for (const cookie of cookies) {
        const url = redeemUrlFromProlinkCookie(cookie.value);
        if (url) {
          resolve(url);
          return;
        }
      }
      resolve(null);
    });
  });
}

export function initStudyratnaCookieDest(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== STUDYRATNA_GET_DEST) return false;
    const href = sender.tab?.url ?? sender.url ?? '';
    if (!href) {
      sendResponse({ url: null });
      return false;
    }
    void readDest(href).then((url) => sendResponse({ url }));
    return true;
  });
}
