import { initAdlinkflyLinksGo } from './adlinkfly-links-go-content-script';
import { initBitcotasksReadArticle } from './bitcotasks-read-article-content-script';
import { initUhdmoviesCloudContentScript } from './uhdmovies-cloud-content-script';
import { initClipiRedirect } from './clipi-redirect-content-script';
import { initCookiesceoCopy } from './cookiesceo-copy-content-script';
import { initFastdlZipRedirect } from './fastdl-zip-redirect-content-script';
import { initFclcRedirect } from './fclc-redirect-content-script';
import { initHdhub4uMainDomainRedirect } from './hdhub4u-main-domain-instant-redirect-content-script';
import { initHdhub4uTimerBypass } from './hdhub4u-timer-bypass-content-script';
import { initHubcdnRedirect } from './hubcdn-redirect-content-script';
import { initLinkjustTimerChainBypass } from './linkjust-timer-chain-bypass-content-script';
import { initHubcloudDrive } from './hubcloud-drive-content-script';
import { initMultiup } from './multiup-content-script';
import { initOnhaxpkCopy } from './onhaxpk-copy-content-script';
import { initOnlinetoolsDirectDownload } from './onlinetools-direct-download-content-script';
import { initPrmoviesRedirect } from './prmovies-redirect-content-script';
import { initShrinkearnRedirect } from './shrinkearn-redirect-content-script';
import { initShrinkmeThemezonMrproblogger } from './shrinkme-themezon-mrproblogger-content-script';
import { initShrtflyRedirect } from './shrtfly-redirect-content-script';
import { initSub2getRedirect } from './sub2get-redirect-content-script';
import { initUsersdriveAutomation } from './usersdrive-countdown-bypass-content-script';
import { initWpSafelinkRedirect } from './wp-safelink-redirect-content-script';

const INITS = [
  initLinkjustTimerChainBypass,
  initUhdmoviesCloudContentScript,
  initAdlinkflyLinksGo,
  initBitcotasksReadArticle,
  initClipiRedirect,
  initCookiesceoCopy,
  initFastdlZipRedirect,
  initFclcRedirect,
  initHdhub4uMainDomainRedirect,
  initHdhub4uTimerBypass,
  initHubcdnRedirect,
  initHubcloudDrive,
  initMultiup,
  initOnhaxpkCopy,
  initOnlinetoolsDirectDownload,
  initPrmoviesRedirect,
  initShrinkearnRedirect,
  initShrinkmeThemezonMrproblogger,
  initShrtflyRedirect,
  initSub2getRedirect,
  initUsersdriveAutomation,
  initWpSafelinkRedirect,
];

for (const init of INITS) {
  try {
    init();
  } catch {}
}
