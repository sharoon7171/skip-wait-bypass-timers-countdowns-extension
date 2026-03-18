import { initMultiup } from './multiup-content-script';
import { initHubcdnRedirect } from './hubcdn-redirect-content-script';
import { initHdhub4uTimerBypass } from './hdhub4u-timer-bypass-content-script';
import { initHdhub4uMainDomainRedirect } from './hdhub4u-main-domain-instant-redirect-content-script';
import { initShrtflyRedirect } from './shrtfly-redirect-content-script';
import { initPrmoviesRedirect } from './prmovies-redirect-content-script';
import { initSub2getRedirect } from './sub2get-redirect-content-script';
import { initClipiRedirect } from './clipi-redirect-content-script';
import { initOnlinetoolsDirectDownload } from './onlinetools-direct-download-content-script';
import { initWpSafelinkRedirect } from './wp-safelink-redirect-content-script';
import { initShrinkearnRedirect } from './shrinkearn-redirect-content-script';
import { initAdlinkflyLinksGo } from './adlinkfly-links-go-content-script';
import { initCookiesceoCopy } from './cookiesceo-copy-content-script';
import { initOnhaxpkCopy } from './onhaxpk-copy-content-script';

const INITS = [
  initMultiup,
  initHubcdnRedirect,
  initHdhub4uTimerBypass,
  initHdhub4uMainDomainRedirect,
  initShrtflyRedirect,
  initPrmoviesRedirect,
  initSub2getRedirect,
  initClipiRedirect,
  initOnlinetoolsDirectDownload,
  initWpSafelinkRedirect,
  initShrinkearnRedirect,
  initAdlinkflyLinksGo,
  initCookiesceoCopy,
  initOnhaxpkCopy,
];

for (const init of INITS) {
  try {
    init();
  } catch {}
}
