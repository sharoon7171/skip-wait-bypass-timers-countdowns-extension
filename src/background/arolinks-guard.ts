import {
  installArolinksUnlockGuard,
  releaseArolinksUnlockGuard,
} from '../content-scripts/arolinks/unlock-guard';
import { MSG_ARO_GUARD_OFF, MSG_ARO_GUARD_ON } from '../content-scripts/arolinks/guard-messages';

function injectMainWorld(tabId: number, fn: () => void): void {
  void chrome.scripting
    .executeScript({ target: { tabId }, func: fn, world: 'MAIN', injectImmediately: true })
    .catch(() => {});
}

export function initArolinksGuard(): void {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    const fn =
      msg?.type === MSG_ARO_GUARD_ON
        ? installArolinksUnlockGuard
        : msg?.type === MSG_ARO_GUARD_OFF
          ? releaseArolinksUnlockGuard
          : null;
    if (!fn) return false;
    injectMainWorld(tabId, fn);
    sendResponse();
    return true;
  });
}
