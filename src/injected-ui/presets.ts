import { createBypassOverlay, type BypassOverlay, type BypassOverlayCopy } from './overlay';

export const linkjustBypassOverlay = createBypassOverlay({
  id: 'skip-wait-linkjust-overlay',
  activeClass: 'sw-linkjust-active',
  sessionKey: 'sw-linkjust-overlay',
  brand: 'Skip Wait · Linkjust',
  countdownLabel: 'seconds left on timer',
});

export const cut4moneyBypassOverlay = createBypassOverlay({
  id: 'skip-wait-cut4money-overlay',
  activeClass: 'sw-cut4money-active',
  sessionKey: 'sw-cut4money-overlay',
  brand: 'Skip Wait',
});

export const arolinksBypassOverlay = createBypassOverlay({
  id: 'skip-wait-arolinks-overlay',
  activeClass: 'sw-arolinks-active',
  sessionKey: 'sw-arolinks-overlay',
  brand: 'Skip Wait',
});

export type OverlayCopy = BypassOverlayCopy;
export type PlatformBypassOverlay = BypassOverlay;
export type Cut4MoneyOverlay = BypassOverlay;
export type LinkjustOverlay = BypassOverlay;

export const {
  readOverlaySession: readLinkjustOverlaySession,
  persistOverlaySession: persistLinkjustOverlaySession,
  clearOverlaySession: clearLinkjustOverlaySession,
  restoreOverlayFromSession: restoreLinkjustOverlayFromSession,
  mountOverlay: mountLinkjustOverlay,
} = linkjustBypassOverlay;

export const {
  readOverlaySession: readCut4MoneyOverlaySession,
  persistOverlaySession: persistCut4MoneyOverlaySession,
  clearOverlaySession: clearCut4MoneyOverlaySession,
  restoreOverlayFromSession: restoreCut4MoneyOverlayFromSession,
  mountOverlay: mountCut4MoneyOverlay,
} = cut4moneyBypassOverlay;

export const { mountOverlay: mountArolinksOverlay } = arolinksBypassOverlay;
