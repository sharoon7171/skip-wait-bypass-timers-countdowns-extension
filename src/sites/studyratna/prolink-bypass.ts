import { STUDYRATNA_GET_DEST } from './hosts';

function isProlinkPath(): boolean {
  return /\/prolink\.php\/?$/i.test(location.pathname);
}

function requestDest(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: STUDYRATNA_GET_DEST }, (resp: { url?: string | null }) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const url = typeof resp?.url === 'string' ? resp.url.trim() : '';
        resolve(url || null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function jumpToDest(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const url = await requestDest();
    if (url) {
      location.replace(url);
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

export function initStudyratnaProlinkBypass(): void {
  if (!isProlinkPath()) return;
  if (!new URLSearchParams(location.search).get('id')) return;
  void jumpToDest();
}
