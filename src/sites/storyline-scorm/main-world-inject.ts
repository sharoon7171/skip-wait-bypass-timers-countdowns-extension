import { isStorylineScormUrl } from './hosts';
import { runStorylineTimerNextBypass } from './main-world-hook';

export function initStorylineScormMainWorldInject(): void {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (!isStorylineScormUrl(details.url)) return;
    void chrome.scripting.executeScript({
      target: { tabId: details.tabId, frameIds: [details.frameId] },
      world: 'MAIN',
      injectImmediately: true,
      func: runStorylineTimerNextBypass,
    });
  });
}
