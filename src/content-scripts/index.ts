import { bootstrapRemoteDomains } from '../utils/remote-domains';
import { initXdmoviesDownloadLink } from './xdmovies-download-link';
import {
  initCoomeetIframeBootstrap,
  isOnCoomeetIframeHost,
  runCoomeetMainWorldAccelerator,
} from './coomeet-iframe';
import './adlink-click-verify-poll';
import './adlinkfly-links-go';
import { initAdlinkflyTokenPayloadRedirect } from './adlinkfly-token-payload-redirect';
import { initBitcotasksReadArticle } from './bitcotasks-read-article';
import { initUhdmoviesCloudContentScript } from './uhdmovies-cloud';
import { initClipiRedirect } from './clipi-redirect';
import { initCookiesceoCopy } from './cookiesceo-copy';
import { initFastdlZipRedirect } from './fastdl-zip-redirect';
import { initFclcRedirect } from './fclc-redirect';
import { initHdhub4uMainDomainRedirect } from './hdhub4u-main-domain-instant-redirect';
import { initHdhub4uTimerBypass } from './hdhub4u-timer-bypass';
import { initHubcdnRedirect } from './hubcdn-redirect';
import { initLinkjustTimerChainBypass } from './linkjust-timer-chain-bypass';
import { initMoviesModContentScript } from './movies-mod';
import { initHubcloudDrive } from './hubcloud-drive';
import { initMultiup } from './multiup';
import { initOlamoviesLinkGenerator } from './olamovies-link-generator';
import { initOnhaxpkCopy } from './onhaxpk-copy';
import { initOnlinetoolsDirectDownload } from './onlinetools-direct-download';
import { initPrmoviesRedirect } from './prmovies-redirect';
import { initRomsfunDownloadInstant } from './romsfun-download-instant';
import { initShrinkmeThemezonMrproblogger } from './shrinkme-themezon-mrproblogger';
import { initShrtflyRedirect } from './shrtfly-redirect';
import { initStbemuiptvcodesWpsafelink } from './stbemuiptvcodes-wpsafelink';
import { initSub2getRedirect } from './sub2get-redirect';
import { initTeknoasianHqChain } from './teknoasian-hq-chain';
import { initUploadrarAutomation } from './uploadrar-countdown-bypass';
import { initUsersdriveAutomation } from './usersdrive-countdown-bypass';
import { initWpSafelinkRedirect } from './wp-safelink-redirect';

const INITS = [
  initXdmoviesDownloadLink,
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
  initOlamoviesLinkGenerator,
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

const isExtensionContext = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

if (!isExtensionContext) {
  runCoomeetMainWorldAccelerator();
} else if (isOnCoomeetIframeHost()) {
  initCoomeetIframeBootstrap();
} else if (window === window.top) {
  void bootstrapRemoteDomains().then(() => {
    for (const init of INITS) {
      try {
        init();
      } catch {}
    }
  });
}
