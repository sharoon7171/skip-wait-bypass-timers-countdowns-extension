import { initFourDownloadDirectLinks } from './4download-direct-links';
import { initXdmoviesMediatorPage } from '../sites/xdmovies';
import {
  initCoomeetIframeBootstrap,
  isOnCoomeetIframeHost,
  runCoomeetMainWorldAccelerator,
} from './coomeet-iframe';
import { initAdfocusRedirect } from '../sites/adfocus';
import {
  initAdlinkClickVerifyPoll,
  initAdlinkflyLinksGo,
  initAdlinkflyTokenPayload,
} from '../sites/adlinkfly';
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
import { initLinkjust } from '../sites/linkjust';
import { initLlSafelinkHqChain } from '../sites/ll-safelink';
import { initLootlabsUnlock } from '../sites/lootlabs';
import { initMoviesModContentScript } from '../sites/movies-mod';
import { initOnhaxpkCopy } from '../sites/onhaxpk';
import { initOnlinetoolsDirectDownload } from '../sites/onlinetools';
import { initOuoBypass } from '../sites/ouo';
import { initPrmoviesRedirect } from '../sites/prmovies';
import { initSidMediatorBypass } from '../sites/sid-mediator';
import { initRomsfunDownloadInstant } from '../sites/romsfun';
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
import { initRarestudyProlinkWait } from '../sites/rarestudy';
import { initStudyratnaProlinkBypass } from '../sites/studyratna';
import { initWahmiCountdownBypass } from '../sites/wahmi';

const INITS = [
  initLootlabsUnlock,
  initLlSafelinkHqChain,
  initLinkjust,
  initShortxlinksSafelinkChain,
  initAdfocusRedirect,
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
  initOuoBypass,
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
  initStudyratnaProlinkBypass,
  initRarestudyProlinkWait,
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
