import { initFourDownloadDirectLinks } from './4download-direct-links';
import { initXdmoviesMediatorPage } from '../sites/xdmovies';
import {
  initCoomeetIframeBootstrap,
  isOnCoomeetIframeHost,
  runCoomeetMainWorldAccelerator,
} from './coomeet-iframe';
import { initAdlinkClickVerifyPoll } from './adlink-click-verify-poll';
import { initArolinksBypass } from './arolinks-bypass';
import { initCut4MoneyBypass } from './cut4money-bypass';
import { initAdlinkflyLinksGo } from './adlinkfly-links-go';
import { initAdlinkflyTokenPayload } from './adlinkfly-token-payload';
import { initBitcotasksReadArticle } from './bitcotasks-read-article';
import { initUhdmoviesMediatorPage } from '../sites/uhdmovies';
import { initClipiRedirect } from './clipi-redirect';
import { initCookiesceoCopy } from './cookiesceo-copy';
import { initFastdlZipRedirect } from './fastdl-zip-redirect';
import { initFclcRedirect } from './fclc-redirect';
import { initFilePressDirectDownload } from '../sites/filepress';
import {
  initHdhub4uLandingPageMed,
  initHdhub4uMediatorPage,
  initHubcdnDl,
  initHubcloudDrive,
} from '../sites/hdhub4u';
import { initKitokolaDlGetBypass } from './kitokola-dl-get-bypass';
import { initLinkjust } from './linkjust';
import { initMoviesModContentScript } from './movies-mod';
import { initMultiup } from './multiup';
import { initOnhaxpkCopy } from './onhaxpk-copy';
import { initOnlinetoolsDirectDownload } from './onlinetools-direct-download';
import { initPrmoviesRedirect } from './prmovies-redirect';
import { initRomsfunDownloadInstant } from './romsfun-download-instant';
import { initShortxlinksSafelinkChain } from './shortxlinks-safelink-chain';
import { initShrinkmeThemezonMrproblogger } from './shrinkme-themezon-mrproblogger';
import { initShrtflyRedirect } from './shrtfly-redirect';
import { initStbemuiptvcodesWpsafelink } from './stbemuiptvcodes-wpsafelink';
import { initSub2getRedirect } from './sub2get-redirect';
import { initTeknoasianHqChain } from './teknoasian-hq-chain';
import { initTinurlzSoftinfoFragment } from './tinurlz-softinfo-fragment';
import { initUploadrarAutomation } from './uploadrar-countdown-bypass';
import { initUsersdriveAutomation } from './usersdrive-countdown-bypass';
import { initWpSafelinkRedirect } from './wp-safelink-redirect';

const INITS = [
  initArolinksBypass,
  initCut4MoneyBypass,
  initLinkjust,
  initShortxlinksSafelinkChain,
  initAdlinkClickVerifyPoll,
  initAdlinkflyLinksGo,
  initFourDownloadDirectLinks,
  initXdmoviesMediatorPage,
  initMoviesModContentScript,
  initUhdmoviesMediatorPage,
  initAdlinkflyTokenPayload,
  initBitcotasksReadArticle,
  initClipiRedirect,
  initCookiesceoCopy,
  initFastdlZipRedirect,
  initFilePressDirectDownload,
  initFclcRedirect,
  initHdhub4uLandingPageMed,
  initHdhub4uMediatorPage,
  initHubcdnDl,
  initHubcloudDrive,
  initKitokolaDlGetBypass,
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
  initTinurlzSoftinfoFragment,
  initUploadrarAutomation,
  initUsersdriveAutomation,
  initWpSafelinkRedirect,
];

const isExtensionContext = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

function boot(): void {
  if (!isExtensionContext) {
    runCoomeetMainWorldAccelerator();
    return;
  }
  if (isOnCoomeetIframeHost()) {
    initCoomeetIframeBootstrap();
    return;
  }
  if (window !== window.top) return;
  for (const init of INITS) {
    try {
      init();
    } catch {}
  }
}

boot();
