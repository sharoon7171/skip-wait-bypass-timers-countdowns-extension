import { bootstrapRemoteDomains } from '../utils/remote-domains';
import { readExtensionEnabled } from '../utils/extension-enabled';
import { initFourDownloadDirectLinks } from './4download-direct-links';
import { initXdmoviesDownloadLink } from './xdmovies-download-link';
import { initXdmoviesLandingRedirect } from './xdmovies-landing-redirect';
import {
  initCoomeetIframeBootstrap,
  isOnCoomeetIframeHost,
  runCoomeetMainWorldAccelerator,
} from './coomeet-iframe';
import { initAdlinkClickVerifyPoll } from './adlink-click-verify-poll';
import { initArolinksBypass } from './arolinks-bypass';
import { initCut4MoneyBypass } from './cut4money-bypass';
import { initAdlinkflyLinksGo } from './adlinkfly-links-go';
import { initAdlinkflyTokenPayloadRedirect } from './adlinkfly-token-payload-redirect';
import { initBitcotasksReadArticle } from './bitcotasks-read-article';
import { initUhdmoviesCloudContentScript } from './uhdmovies-cloud';
import { initClipiRedirect } from './clipi-redirect';
import { initCookiesceoCopy } from './cookiesceo-copy';
import { initFastdlZipRedirect } from './fastdl-zip-redirect';
import { initFclcRedirect } from './fclc-redirect';
import { initHdhub4uLandingRedirect } from './hdhub4u-landing-redirect';
import { initHdhub4uTimerBypass } from './hdhub4u-timer-bypass';
import { initHubcdnRedirect } from './hubcdn-redirect';
import { initKitokolaDlGetBypass } from './kitokola-dl-get-bypass';
import { initLinkjustTimerChainBypass } from './linkjust-timer-chain-bypass';
import { initMoviesModContentScript } from './movies-mod';
import { initHubcloudDrive } from './hubcloud-drive';
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
  initAdlinkClickVerifyPoll,
  initAdlinkflyLinksGo,
  initFourDownloadDirectLinks,
  initXdmoviesLandingRedirect,
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
  initHdhub4uLandingRedirect,
  initHdhub4uTimerBypass,
  initHubcdnRedirect,
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

function bootCut4MoneyBypass(): void {
  if (!isExtensionContext || window !== window.top) return;
  initArolinksBypass();
  initCut4MoneyBypass();
}

bootCut4MoneyBypass();

function bootLinkjustBypass(): void {
  if (!isExtensionContext || window !== window.top) return;
  initLinkjustTimerChainBypass();
}

bootLinkjustBypass();

async function runWhenEnabled(): Promise<void> {
  if (!isExtensionContext) {
    runCoomeetMainWorldAccelerator();
    return;
  }
  if (!(await readExtensionEnabled())) return;
  if (isOnCoomeetIframeHost()) {
    initCoomeetIframeBootstrap();
  } else if (window === window.top) {
    initShortxlinksSafelinkChain();
    void bootstrapRemoteDomains().then(() => {
      for (const init of INITS) {
        try {
          init();
        } catch {}
      }
    });
  }
}

void runWhenEnabled();
