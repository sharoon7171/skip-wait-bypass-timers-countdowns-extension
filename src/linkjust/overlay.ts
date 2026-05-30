import {
  createBypassOverlay,
  type BypassOverlay,
  type BypassOverlayCopy,
} from '../shared/bypass-overlay';

const overlay = createBypassOverlay({
  id: 'skip-wait-linkjust-overlay',
  activeClass: 'sw-linkjust-active',
  sessionKey: 'sw-linkjust-overlay',
  brand: 'Skip Wait · Linkjust',
  countdownLabel: 'seconds left on timer',
});

export type OverlayCopy = BypassOverlayCopy;
export type LinkjustOverlay = BypassOverlay;

export const {
  readOverlaySession,
  persistOverlaySession,
  clearOverlaySession,
  restoreOverlayFromSession,
  mountOverlay: mountLinkjustOverlay,
} = overlay;
