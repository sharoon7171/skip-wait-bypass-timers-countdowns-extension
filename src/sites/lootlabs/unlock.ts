import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { whenDomReady } from '../../utils/domain-check';
import { isLootLockerPage } from './locker';
import { LOOT_MSG_SOURCE, MSG_INJECT_LOOT } from './main-world-hook';

const OVERLAY_ID = 'skip-wait-loot-overlay';

type LootMessage =
  | { source?: string; type: 'wait'; endTs: number }
  | { source?: string; type: 'dest'; dest: string }
  | { source?: string; type: 'err'; message: string };

export function initLootlabsUnlock(): void {
  if (window !== window.top) return;

  void whenDomReady(isLootLockerPage).then(() => {
    const ui = createFullPageOverlay({
      id: OVERLAY_ID,
      brand: 'Skip Wait',
      note: {
        lead: 'Unlocking your link.',
        detail: 'Hang tight — we’ll open the destination as soon as the server releases it.',
      },
      status: 'Getting things ready…',
      countdownLabel: 'Your link opens in',
    });

    window.addEventListener('message', (ev: MessageEvent) => {
      if (ev.source !== window || ev.origin !== location.origin) return;
      const data = ev.data as LootMessage;
      if (data?.source !== LOOT_MSG_SOURCE || !data.type) return;

      if (data.type === 'wait') {
        ui.setStatus('Waiting for your link…');
        ui.startCountdown(data.endTs);
        return;
      }
      if (data.type === 'dest') {
        ui.stopCountdown();
        ui.setStatus('Opening your link…');
        return;
      }
      if (data.type === 'err') {
        ui.hideCountdown();
        ui.setStatus('Something went wrong.');
        ui.setError(data.message);
      }
    });

    chrome.runtime.sendMessage({ type: MSG_INJECT_LOOT });
  });
}
