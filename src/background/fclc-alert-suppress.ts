import { isExtensionEnabledSync } from '../utils/extension-enabled';

export const MSG_FCLC_ALERT_SUPPRESS = 'FCLC_ALERT_SUPPRESS' as const;

function suppressAlert(): void {
  window.alert = function () {};
}

export function initFclcAlertSuppress(): void {
  chrome.runtime.onMessage.addListener((msg: { type?: string }, sender, sendResponse) => {
    if (msg?.type !== MSG_FCLC_ALERT_SUPPRESS || !sender.tab?.id) {
      sendResponse();
      return;
    }
    if (!isExtensionEnabledSync()) {
      sendResponse();
      return;
    }
    chrome.scripting
      .executeScript({ target: { tabId: sender.tab.id }, func: suppressAlert, world: 'MAIN', injectImmediately: true })
      .then(sendResponse)
      .catch(sendResponse);
    return true;
  });
}
