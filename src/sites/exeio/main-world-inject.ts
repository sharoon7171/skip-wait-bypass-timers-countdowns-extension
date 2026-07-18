import { EXEIO_HOSTS, MSG_EXEIO_ADBLOCK } from './hosts';
import { runExeioAdblockBypass } from './adblock-bypass';

function isExeioUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return EXEIO_HOSTS.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

function inject(tabId: number, frameId?: number): void {
  void chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
    world: 'MAIN',
    injectImmediately: true,
    func: runExeioAdblockBypass,
  });
}

export function initExeioAdblockInject(): void {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0 || !isExeioUrl(details.url)) return;
    inject(details.tabId, 0);
  });

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== MSG_EXEIO_ADBLOCK) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    inject(tabId, sender.frameId ?? 0);
    return false;
  });
}
