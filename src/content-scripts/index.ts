import { initFourDownloadDirectLinks } from './4download-direct-links';
import { initXdmoviesMediatorPage } from '../sites/xdmovies';
import {
  initCoomeetIframeBootstrap,
  isOnCoomeetIframeHost,
  runCoomeetMainWorldAccelerator,
} from './coomeet-iframe';
import { initAdlinkClickVerifyPoll } from './adlink-click-verify-poll';
import { initAdlinkflyLinksGo } from '../sites/adlinkfly';
import { initAdlinkflyTokenPayload } from './adlinkfly-token-payload';
import { initBitcotasksReadArticle } from './bitcotasks-read-article';
import { initClipiRedirect } from '../sites/clipi';
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
import { initLlSafelinkHqChain } from '../sites/ll-safelink';
import { initMoviesModContentScript } from '../sites/movies-mod';
import { initOnhaxpkCopy } from '../sites/onhaxpk';
import { initOnlinetoolsDirectDownload } from '../sites/onlinetools';
import { initPrmoviesRedirect } from '../sites/prmovies';
import { initSidMediatorBypass } from '../sites/sid-mediator';
import { initRomsfunDownloadInstant } from './romsfun-download-instant';
import { initShortxlinksSafelinkChain } from './shortxlinks-safelink-chain';
import { initShrinkmeThemezonMrproblogger } from './shrinkme-themezon-mrproblogger';
import { initShrtslugRedirect } from '../sites/shrtslug';
import { initStbemuiptvcodesWpsafelink, initWpSafelinkRedirect } from '../sites/wp-safelink';
import { initSub2getRedirect } from '../sites/sub2get';
import { initTinurlzSoftinfoFragment } from './tinurlz-softinfo-fragment';
import { initKaranpcMediatorPage } from '../sites/karanpc';
import { initUsersdriveAutomation } from '../sites/usersdrive';
import { initMega4uploadBypass } from '../sites/mega4upload';
import { initPlingDirectDownload } from '../sites/pling';
import { initWahmiCountdownBypass } from '../sites/wahmi';

const INITS = [
  initLlSafelinkHqChain,
  initShortxlinksSafelinkChain,
  initAdlinkClickVerifyPoll,
  initAdlinkflyLinksGo,
  initFourDownloadDirectLinks,
  initXdmoviesMediatorPage,
  initMoviesModContentScript,
  initSidMediatorBypass,
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
  initOnhaxpkCopy,
  initOnlinetoolsDirectDownload,
  initPrmoviesRedirect,
  initRomsfunDownloadInstant,
  initShrinkmeThemezonMrproblogger,
  initShrtslugRedirect,
  initStbemuiptvcodesWpsafelink,
  initSub2getRedirect,
  initTinurlzSoftinfoFragment,
  initKaranpcMediatorPage,
  initUsersdriveAutomation,
  initMega4uploadBypass,
  initPlingDirectDownload,
  initWahmiCountdownBypass,
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
