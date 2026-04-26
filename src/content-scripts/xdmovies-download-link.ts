import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

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

function overlayCss(): string {
  const o = OVERLAY_ID;
  return `#${o}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(15,23,42,.86);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc;pointer-events:auto;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:default;overscroll-behavior:contain}#${o} *{user-select:none;-webkit-user-select:none}#${o} .sw-card{max-width:420px;width:100%;border-radius:16px;padding:22px 22px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5);pointer-events:none}#${o} .sw-brand{font-size:1.25rem;font-weight:700;letter-spacing:-.02em;color:#38bdf8;margin-bottom:6px}#${o} .sw-note{font-size:.875rem;line-height:1.55;color:#cbd5e1;margin-bottom:14px}#${o} .sw-note strong{color:#e2e8f0;font-weight:600}#${o} .sw-status{font-size:.9rem;color:#e2e8f0;min-height:1.4em;margin-bottom:10px}#${o} .sw-count{font-size:2.5rem;font-weight:700;font-variant-numeric:tabular-nums;color:#f1f5f9;text-align:center;margin:6px 0 4px}#${o} .sw-count-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;text-align:center}#${o} .sw-count-hint{font-size:.78rem;color:#94a3b8;text-align:center;margin-top:4px}#${o} .sw-err{font-size:.85rem;color:#fca5a5;margin-top:10px;line-height:1.45}#turnstileContainer,#turnstileWidget{position:fixed!important;left:50%!important;top:calc(50% + 156px)!important;bottom:auto!important;right:auto!important;transform:translateX(-50%)!important;z-index:2147483647!important;pointer-events:auto!important;display:block!important;margin:0!important;padding:0!important;border-radius:8px!important;overflow:hidden!important;box-shadow:0 12px 32px -10px rgba(0,0,0,.55)!important}`;
}

function createOverlay() {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  const st = document.createElement('style');
  st.textContent = overlayCss();
  root.appendChild(st);
  const card = document.createElement('div');
  card.className = 'sw-card';
  const brand = document.createElement('div');
  brand.className = 'sw-brand';
  brand.textContent = 'Skip Wait';
  const note = document.createElement('div');
  note.className = 'sw-note';
  note.innerHTML =
    '<strong>Hang tight — getting your download ready.</strong> You don’t need to tap anything on the page. We’ll open your link automatically when it’s done.';
  const status = document.createElement('div');
  status.className = 'sw-status';
  status.textContent = 'Getting things ready…';
  const count = document.createElement('div');
  count.className = 'sw-count';
  count.style.display = 'none';
  const countLabel = document.createElement('div');
  countLabel.className = 'sw-count-label';
  countLabel.style.display = 'none';
  const countHint = document.createElement('div');
  countHint.className = 'sw-count-hint';
  countHint.style.display = 'none';
  const err = document.createElement('div');
  err.className = 'sw-err';
  err.style.display = 'none';
  card.append(brand, note, status, count, countLabel, countHint, err);
  root.appendChild(card);
  let rafId = 0;
  const stopCountdown = (hide: boolean): void => {
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (hide) count.style.display = countLabel.style.display = countHint.style.display = 'none';
  };
  return {
    root,
    setStatus: (t: string) => {
      status.textContent = t;
    },
    setNote: (html: string) => {
      note.innerHTML = html;
    },
    setError: (t: string | null) => {
      err.textContent = t ?? '';
      err.style.display = t ? 'block' : 'none';
    },
    startRealtimeCountdown: (endTs: number) => {
      count.style.display = countLabel.style.display = countHint.style.display = 'block';
      countLabel.textContent = 'Your link opens in';
      countHint.textContent = 'If a checkbox appears at the bottom, tap it to confirm you’re human';
      const tick = (): void => {
        const left = endTs - Date.now();
        count.textContent = `${(Math.max(0, left) / 1000).toFixed(2)} s`;
        if (left <= 0) {
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    },
    stopCountdown: () => stopCountdown(false),
    hideCountdown: () => stopCountdown(true),
  };
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
        ui.startRealtimeCountdown(d.waitEndTs!);
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
