import { initXdmoviesLatestnewsAutomation } from './xdmovies-latestnews-automation';
import { initCoomeetIframeBootstrap } from './coomeet-iframe';
import './adlink-click-verify-poll-content-script';
import './adlinkfly-links-go-content-script';
import { initAdlinkflyTokenPayloadRedirect } from './adlinkfly-token-payload-redirect-content-script';
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
import { initMoviesModContentScript } from './movies-mod-content-script';
import { initHubcloudDrive } from './hubcloud-drive-content-script';
import { initMultiup } from './multiup-content-script';
import { initOnhaxpkCopy } from './onhaxpk-copy-content-script';
import { initOnlinetoolsDirectDownload } from './onlinetools-direct-download-content-script';
import { initPrmoviesRedirect } from './prmovies-redirect-content-script';
import { initRomsfunDownloadInstant } from './romsfun-download-instant-content-script';
import { initShrinkmeThemezonMrproblogger } from './shrinkme-themezon-mrproblogger-content-script';
import { initShrtflyRedirect } from './shrtfly-redirect-content-script';
import { initStbemuiptvcodesWpsafelink } from './stbemuiptvcodes-wpsafelink-content-script';
import { initSub2getRedirect } from './sub2get-redirect-content-script';
import { initTeknoasianHqChain } from './teknoasian-hq-chain-content-script';
import { initUploadrarAutomation } from './uploadrar-countdown-bypass-content-script';
import { initUsersdriveAutomation } from './usersdrive-countdown-bypass-content-script';
import { initWpSafelinkRedirect } from './wp-safelink-redirect-content-script';

const INITS = [
  initXdmoviesLatestnewsAutomation,
  initLinkjustTimerChainBypass,
  initMoviesModContentScript,
  initUhdmoviesCloudContentScript,
  initAdlinkflyTokenPayloadRedirect,
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
  initRomsfunDownloadInstant,
  initShrinkmeThemezonMrproblogger,
  initShrtflyRedirect,
  initStbemuiptvcodesWpsafelink,
  initSub2getRedirect,
  initTeknoasianHqChain,
  initUploadrarAutomation,
  initUsersdriveAutomation,
  initWpSafelinkRedirect,
];

function currentHostname(): string {
  try {
    return new URL(window.location.href).hostname;
  } catch {
    return '';
  }
}

if (currentHostname() === 'iframe.coomeet.com') {
  initCoomeetIframeBootstrap();
} else if (window === window.top) {
  for (const init of INITS) {
    try {
      init();
    } catch {}
  }
}
