import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { decodeProlinkDest, isRarestudySuccessUrl, RARESTUDY_WAIT_MS } from './hosts';

const OVERLAY_ID = 'skip-wait-rarestudy-prolink-overlay';
const WAIT_KEY = 'skip-wait-rarestudy-wait';

type WaitState = { dest: string; endAt: number };

function stopPageTimers(): void {
  const highest = window.setInterval(() => {}, 1e9);
  for (let i = 0; i <= highest; i++) window.clearInterval(i);
}

function readWait(): WaitState | null {
  try {
    const raw = sessionStorage.getItem(WAIT_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as WaitState;
    if (!state?.dest || !isRarestudySuccessUrl(state.dest) || typeof state.endAt !== 'number') {
      sessionStorage.removeItem(WAIT_KEY);
      return null;
    }
    return state;
  } catch {
    sessionStorage.removeItem(WAIT_KEY);
    return null;
  }
}

function waitOnHome(state: WaitState): void {
  stopPageTimers();

  const left = state.endAt - Date.now();
  if (left <= 0) {
    sessionStorage.removeItem(WAIT_KEY);
    location.replace(state.dest);
    return;
  }

  const ui = createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: {
      lead: 'Skip Wait is generating your rarestudy access.',
      detail: 'Leave this tab open — no mediator steps needed.',
    },
    status: 'Waiting for access window…',
    countdownLabel: 'Seconds left',
  });
  ui.startCountdown(state.endAt);

  window.setTimeout(() => {
    sessionStorage.removeItem(WAIT_KEY);
    ui.setStatus('Opening access…');
    location.replace(state.dest);
  }, left);
}

function leaveProlinkForHome(dest: string): void {
  stopPageTimers();
  sessionStorage.setItem(
    WAIT_KEY,
    JSON.stringify({ dest, endAt: Date.now() + RARESTUDY_WAIT_MS } satisfies WaitState),
  );
  createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: {
      lead: 'Skip Wait is generating your rarestudy access.',
      detail: 'Moving to TipsGuru…',
    },
    status: 'Starting wait…',
  });
  location.replace(`${location.origin}/`);
}

export function initRarestudyProlinkWait(): void {
  const pending = readWait();
  if (pending && location.pathname === '/') {
    waitOnHome(pending);
    return;
  }

  if (!/\/prolink\.php\/?$/i.test(location.pathname)) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  const dest = decodeProlinkDest(id);
  if (!dest || !isRarestudySuccessUrl(dest)) return;

  leaveProlinkForHome(dest);
}
