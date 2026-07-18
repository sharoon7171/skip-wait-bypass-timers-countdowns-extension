import { CUTY_HOSTS, MSG_CUTY_ADBLOCK } from './hosts';
import { runCutyAdblockBypass } from './adblock-bypass';

function isCutyUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return CUTY_HOSTS.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

function inject(tabId: number, frameId?: number): void {
  void chrome.scripting.executeScript({
    target: frameId === undefined ? { tabId } : { tabId, frameIds: [frameId] },
    world: 'MAIN',
    func: runCutyAdblockBypass,
  });
}

export function initCutyAdblockInject(): void {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== MSG_CUTY_ADBLOCK) return false;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return false;
    if (sender.tab?.url && !isCutyUrl(sender.tab.url)) return false;
    inject(tabId, sender.frameId ?? 0);
    return false;
  });
}
