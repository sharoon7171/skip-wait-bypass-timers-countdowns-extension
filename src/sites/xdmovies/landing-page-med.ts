import { hostnameMatches } from '../../utils/domain-check';

const LANDING_PAGE_HOSTS = ['xdmovies.com'] as const;
const MIRROR_URL = 'https://xdmovies.site/';

export function initXdmoviesLandingPageNav(): void {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    try {
      if (!hostnameMatches(new URL(details.url).hostname, LANDING_PAGE_HOSTS)) return;
    } catch {
      return;
    }
    void chrome.tabs.update(details.tabId, { url: MIRROR_URL });
  });
}
