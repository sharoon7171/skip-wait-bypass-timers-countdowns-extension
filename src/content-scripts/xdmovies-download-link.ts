import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import { createProgressOverlay, turnstileWidgetCss, type ProgressOverlay } from '../injected-ui/progress-overlay';

const KEY = 'xdmovies-download-link';
const MSG_SOURCE = 'skip-wait-xdmovies';
const MSG_VISIBILITY = 'INJECT_VISIBILITY_SPOOF';
const OVERLAY_ID = 'skip-wait-xdmovies-overlay';
const PATH = /^\/(?:r|download)\/([^/]+)/;
const SERVER_WAIT_MS = 10_500;
const TURNSTILE_SITEKEY = '0x4AAAAAACwMJhFoINTv6AGb';
const XDMOVIES_MAIN_WORLD_RUN = 'XDMOVIES_MAIN_WORLD_RUN';

async function xdmoviesFingerprint(): Promise<string> {
  const cv = document.createElement('canvas');
  const x = cv.getContext('2d')!;
  x.textBaseline = 'top';
  x.font = '14px Arial';
  x.fillStyle = '#f60';
  x.fillRect(125, 1, 62, 20);
  x.fillStyle = '#069';
  x.fillText('XDMovies,🎬', 2, 15);
  x.fillStyle = 'rgba(102, 204, 0, 0.7)';
  x.fillText('XDMovies,🎬', 4, 17);
  const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null;
  const di = gl?.getExtension('WEBGL_debug_renderer_info');
  const nav = navigator as Navigator & { deviceMemory?: number };
  const s = [
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    nav.language,
    nav.platform,
    String(nav.hardwareConcurrency),
    String(nav.deviceMemory),
    cv.toDataURL().slice(-50),
    di ? String(gl!.getParameter(di.UNMASKED_RENDERER_WEBGL)) : '',
    'ontouchstart' in window ? 'touch' : 'no_touch',
    String(nav.plugins.length),
    String(nav.cookieEnabled),
    String(nav.doNotTrack),
  ].join('|||');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function createOverlay(): ProgressOverlay {
  return createProgressOverlay({
    id: OVERLAY_ID,
    noteHtml:
      '<strong>Hang tight — getting your download ready.</strong> You don’t need to tap anything on the page. We’ll open your link automatically when it’s done.',
    status: 'Getting things ready…',
    countdownHint: 'If a checkbox appears at the bottom, tap it to confirm you’re human',
    blockInteraction: false,
    extraCss: turnstileWidgetCss,
  });
}

async function runDownloadLinkFlow(code: string): Promise<void> {
  const ui = createOverlay();
  document.documentElement.appendChild(ui.root);
  window.addEventListener('message', (ev: MessageEvent): void => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data as { source?: string; phase?: string; waitEndTs?: number; message?: string };
    if (d?.source !== MSG_SOURCE) return;
    switch (d.phase) {
      case 'parallel':
        ui.setNote(
          '<strong>Almost there.</strong> If a checkbox appears at the bottom, tap it to confirm you’re human. Otherwise, just wait — your link opens here automatically.',
        );
        ui.setStatus('Waiting for your link to open…');
        ui.startCountdown(d.waitEndTs!);
        break;
      case 'complete':
        ui.stopCountdown();
        ui.setStatus('Almost ready…');
        break;
      case 'redirect':
        ui.setStatus('Opening your download…');
        break;
      case 'turnstile_error':
      case 'turnstile_expired':
        ui.setStatus('That check didn’t go through. Wait a moment or refresh the page.');
        break;
      case 'error':
        ui.hideCountdown();
        ui.setStatus('Something went wrong.');
        ui.setError(d.message!);
        break;
    }
  });
  const fingerprint = await xdmoviesFingerprint();
  ui.setStatus('Almost there…');
  chrome.runtime.sendMessage({
    type: XDMOVIES_MAIN_WORLD_RUN,
    payload: { code, fingerprint, waitMs: SERVER_WAIT_MS, sitekey: TURNSTILE_SITEKEY, msgSource: MSG_SOURCE },
  });
}

export function initXdmoviesDownloadLink(): void {
  if (window !== window.top || !isAllowedHost(getHostsByKey(KEY))) return;
  const code = location.pathname.match(PATH)?.[1];
  if (!code) return;
  chrome.runtime.sendMessage({ type: MSG_VISIBILITY });
  void runDownloadLinkFlow(code);
}
