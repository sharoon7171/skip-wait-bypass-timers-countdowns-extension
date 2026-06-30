import { initExtensionEnabledCache, setExtensionEnabledActivator } from '../utils/extension-enabled';
import { initCoomeetMainWorldInject } from './coomeet-main-world-inject';
import { initDocumentVisibilitySpoof } from './document-visibility-spoof';
import { initFclcAlertSuppress } from './fclc-alert-suppress';
import { initFlightsimToMainWorldInject } from './flightsim-to-main-world';
import { initArolinksGuard } from './arolinks-guard';
import { initCut4MoneyShr2Hop } from './cut4money-shr2-hop';
import { initShortxlinksFetchChain } from './shortxlinks-fetch-chain';
import { initXdmoviesMainWorldInject } from './xdmovies-main-world';

let backgroundReady = false;

function activateBackgroundModules(): void {
  if (backgroundReady) return;
  backgroundReady = true;
  initCoomeetMainWorldInject();
  initDocumentVisibilitySpoof();
  initFclcAlertSuppress();
  initFlightsimToMainWorldInject();
  initArolinksGuard();
  initShortxlinksFetchChain();
  initCut4MoneyShr2Hop();
  initXdmoviesMainWorldInject();
}

setExtensionEnabledActivator(activateBackgroundModules);
initExtensionEnabledCache();
