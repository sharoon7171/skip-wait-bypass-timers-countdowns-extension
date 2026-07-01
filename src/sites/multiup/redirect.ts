const BASE = 'https://multiup.io/en/mirror/';
const MIRROR = '/en/mirror/';
const DIRECT_RE = /multiup\.io\/([a-zA-Z0-9]+)/;
const PHP_RE = /\/multiup\.php\?id=([a-zA-Z0-9]+)/;

function mirrorId(url: string): string | null {
  if (!url.includes('multiup') || url.includes(MIRROR)) return null;
  return url.match(PHP_RE)?.[1] ?? url.match(DIRECT_RE)?.[1] ?? null;
}

export function initMultiup(): void {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    const id = mirrorId(details.url);
    if (!id) return;
    void chrome.tabs.update(details.tabId, { url: `${BASE}${id}` });
  });
}
