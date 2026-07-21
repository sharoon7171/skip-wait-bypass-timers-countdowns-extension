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
import { initArolinksUnlock, initArolinksMediator } from '../sites/arolinks';
import { initGplinksGate, initGplinksLinksGo, initGplinksMediator } from '../sites/gplinks';
import { initNitrolinkMediator, initNitrolinkUnlock } from '../sites/nitrolink';
import { initBitcotasksReadArticle } from './bitcotasks-read-article';
import { initClipiRedirect } from '../sites/clipi';
import { initCookiesceoCopy } from './cookiesceo-copy';
import { initFastdlZipRedirect } from './fastdl-zip-redirect';
import { initFclcMediatorPage, initFclcShortlinkPage } from '../sites/fclc';
import { initIcutlinkLinksGo, initIcutlinkMediatorPage } from '../sites/icutlink';
import { initFilePressDirectDownload } from '../sites/filepress';
import {
  initHdhub4uLandingPageMed,
  initHdhub4uMediatorPage,
  initHubcdnDl,
  initHubcloudDrive,
} from '../sites/hdhub4u';
import { initKitokolaDlGetBypass } from './kitokola-dl-get-bypass';
import { initKotakanimeidOutPage } from '../sites/kotakanimeid';
import { initLinkjust } from '../sites/linkjust';
import { initLinknextGate } from '../sites/linknext';
import { initLinksterrGateway } from '../sites/linksterr';
import { initLinkvertiseAccessPage } from '../sites/linkvertise';
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
import { initMirroredFilesPage } from '../sites/mirrored';
import { initMove2linkGate } from '../sites/move2link';
import { initMp4uploadCountdownBypass } from '../sites/mp4upload';
import { initPlingDirectDownload } from '../sites/pling';
import { initRarestudyProlinkWait } from '../sites/rarestudy';
import { initStudyratnaProlinkBypass } from '../sites/studyratna';
import { initWahmiCountdownBypass } from '../sites/wahmi';
import { initCutyGate } from '../sites/cuty';
import { initExeioGate } from '../sites/exeio';
import { initStorylineCoursePlayBrand } from '../sites/storyline-scorm';

const INITS = [
  initStorylineCoursePlayBrand,
  initLinknextGate,
  initLinkvertiseAccessPage,
  initCutyGate,
  initExeioGate,
  initLootlabsUnlock,
  initLlSafelinkHqChain,
  initLinkjust,
  initLinksterrGateway,
  initShortxlinksSafelinkChain,
  initAdfocusRedirect,
  initGplinksGate,
  initGplinksMediator,
  initGplinksLinksGo,
  initArolinksMediator,
  initArolinksUnlock,
  initNitrolinkMediator,
  initNitrolinkUnlock,
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
  initFclcShortlinkPage,
  initFclcMediatorPage,
  initIcutlinkMediatorPage,
  initIcutlinkLinksGo,
  initHdhub4uLandingPageMed,
  initHdhub4uMediatorPage,
  initHubcdnDl,
  initHubcloudDrive,
  initKitokolaDlGetBypass,
  initKotakanimeidOutPage,
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
  initMirroredFilesPage,
  initMove2linkGate,
  initMp4uploadCountdownBypass,
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
