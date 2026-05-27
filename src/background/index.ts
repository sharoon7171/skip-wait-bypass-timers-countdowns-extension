import { initExtensionEnabledCache } from '../utils/extension-enabled';
import { initCoomeetMainWorldInject } from './coomeet-main-world-inject';
import { initDocumentVisibilitySpoof } from './document-visibility-spoof';
import { initFclcAlertSuppress } from './fclc-alert-suppress';
import { initFlightsimToMainWorldInject } from './flightsim-to-main-world';
import { initShortxlinksFetchChain } from './shortxlinks-fetch-chain';
import { initXdmoviesMainWorldInject } from './xdmovies-main-world';

initExtensionEnabledCache();
initCoomeetMainWorldInject();
initDocumentVisibilitySpoof();
initFclcAlertSuppress();
initFlightsimToMainWorldInject();
initShortxlinksFetchChain();
initXdmoviesMainWorldInject();
