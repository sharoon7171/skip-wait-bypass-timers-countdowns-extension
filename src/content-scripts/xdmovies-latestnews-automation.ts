const PATH = /^\/(?:r|download)\/[^/]+/;
const MSG_VISIBILITY = 'INJECT_VISIBILITY_SPOOF';
const OVERLAY_ID = 'skip-wait-xdmovies-overlay';
const MSG_SOURCE = 'skip-wait-xdmovies';
const SERVER_WAIT_MS = 10_500;
const TURNSTILE_SITEKEY = '0x4AAAAAACwMJhFoINTv6AGb';
const XDMOVIES_MAIN_WORLD_RUN = 'XDMOVIES_MAIN_WORLD_RUN';

async function xdmoviesFingerprint(): Promise<string> {
  const c: string[] = [];
  c.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  c.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  c.push(navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage || '');
  c.push(navigator.platform);
  c.push(String(navigator.hardwareConcurrency || 'unknown'));
  c.push(String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'unknown'));
  try {
    const cv = document.createElement('canvas');
    const x = cv.getContext('2d');
    if (x) {
      x.textBaseline = 'top';
      x.font = '14px Arial';
      x.fillStyle = '#f60';
      x.fillRect(125, 1, 62, 20);
      x.fillStyle = '#069';
      x.fillText('XDMovies,🎬', 2, 15);
      x.fillStyle = 'rgba(102, 204, 0, 0.7)';
      x.fillText('XDMovies,🎬', 4, 17);
      c.push(cv.toDataURL().slice(-50));
    } else c.push('canvas_error');
  } catch {
    c.push('canvas_error');
  }
  try {
    const cv = document.createElement('canvas');
    const gl = (cv.getContext('webgl') || cv.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const di = gl.getExtension('WEBGL_debug_renderer_info');
      if (di) c.push(String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)));
    }
  } catch {
    c.push('webgl_error');
  }
  c.push('ontouchstart' in window ? 'touch' : 'no_touch');
  c.push(String(navigator.plugins ? navigator.plugins.length : 0));
  c.push(String(navigator.cookieEnabled));
  c.push(String(navigator.doNotTrack || 'unset'));
  const s = c.join('|||');
  if (!crypto?.subtle) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charCodeAt(i);
      h = (h << 5) - h + ch;
      h = h & h;
    }
    return Math.abs(h).toString(16).padStart(32, '0').slice(0, 32);
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function pathCode(): string | null {
  const p = location.pathname.split('/').filter(Boolean);
  const last = p[p.length - 1];
  if (!last || last === 'r' || last === 'download') return null;
  return last;
}

function overlayCss(): string {
  const o = OVERLAY_ID;
  return `#${o}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 0;box-sizing:border-box;background:rgba(15,23,42,.92);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc}#${o} .sw-card{max-width:420px;width:100%;border-radius:16px;padding:28px 24px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5);pointer-events:none}#${o}.sw-pass{pointer-events:none;padding-bottom:0;background:linear-gradient(180deg,rgba(15,23,42,.92) 0%,rgba(15,23,42,.4) 26%,rgba(15,23,42,.08) 40%,transparent 50%)}#${o}.sw-pass .sw-card{max-height:min(44vh,360px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 18px 16px}#${o} .sw-brand{font-size:1.35rem;font-weight:700;letter-spacing:-.02em;color:#38bdf8;margin-bottom:8px}#${o} .sw-note{font-size:.875rem;line-height:1.55;color:#cbd5e1;margin-bottom:16px}#${o} .sw-note strong{color:#e2e8f0;font-weight:600}#${o} .sw-status{font-size:.9rem;color:#e2e8f0;min-height:1.4em;margin-bottom:12px}#${o} .sw-count{font-size:2.75rem;font-weight:700;font-variant-numeric:tabular-nums;color:#f1f5f9;text-align:center;margin:8px 0 4px}#${o} .sw-count-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;text-align:center}#${o} .sw-count-hint{font-size:.8rem;color:#94a3b8;text-align:center;margin-top:4px}#${o} .sw-err{font-size:.85rem;color:#fca5a5;margin-top:12px;line-height:1.45}`;
}

function fmtRemain(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(2)} s`;
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
    '<strong>Skip Wait is handling this link.</strong> Do not use the site’s “Generate link”, “Continue”, or other steps—those are skipped. Stay on this tab; we redirect automatically when ready.';
  const status = document.createElement('div');
  status.className = 'sw-status';
  status.textContent = 'Preparing…';
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
  card.append(brand, note, status, count, countLabel, countHint, err);
  root.appendChild(card);
  let rafId = 0;
  return {
    root,
    setStatus: (t: string) => {
      status.textContent = t;
    },
    setNote: (html: string) => {
      note.innerHTML = html;
    },
    setCountdown: (n: number | null) => {
      if (n === null) {
        count.style.display = countLabel.style.display = countHint.style.display = 'none';
        return;
      }
      count.style.display = countLabel.style.display = 'block';
      count.textContent = String(Math.max(0, n));
    },
    startRealtimeCountdown: (endTs: number) => {
      count.style.display = countLabel.style.display = countHint.style.display = 'block';
      countLabel.textContent = 'Host unlock timer';
      countHint.textContent = 'Runs together with Cloudflare; no extra click here when done';
      const tick = (): void => {
        const left = endTs - Date.now();
        count.textContent = fmtRemain(left);
        if (left <= 0) {
          count.textContent = '0.00 s';
          rafId = 0;
          return;
        }
        rafId = requestAnimationFrame(tick);
      };
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    },
    stopRealtimeCountdown: () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
    },
    setCountHint: (t: string | null) => {
      if (t === null) countHint.style.display = 'none';
      else {
        countHint.textContent = t;
        countHint.style.display = 'block';
      }
    },
    setError: (t: string | null) => {
      err.textContent = t ?? '';
      err.style.display = t ? 'block' : 'none';
    },
    setPageVerifyMode: (on: boolean) => root.classList.toggle('sw-pass', on),
  };
}

async function runDirectFlow(): Promise<void> {
  if (!PATH.test(location.pathname) || document.getElementById(OVERLAY_ID)) return;
  const code = pathCode();
  if (!code) return;
  const ui = createOverlay();
  document.documentElement.appendChild(ui.root);
  const onMessage = (ev: MessageEvent): void => {
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data as { source?: string; phase?: string; waitEndTs?: number; message?: string };
    if (!d || d.source !== MSG_SOURCE) return;
    switch (d.phase) {
      case 'session':
        ui.setStatus('Connecting to the host…');
        ui.setError(null);
        break;
      case 'parallel': {
        const endTs =
          typeof d.waitEndTs === 'number' ? d.waitEndTs : Date.now() + SERVER_WAIT_MS;
        ui.setNote(
          '<strong>What to do:</strong> Ignore “Generate” / “Continue” on this page. Complete only the <strong>Cloudflare</strong> check—it sits in the <strong>clear area below this card</strong> (we fade the dimming so you can see it). <strong>We redirect this tab automatically</strong> when the timer and verification are done.',
        );
        ui.setStatus('Wait for the timer, then Cloudflare if shown—we open your link for you.');
        ui.setPageVerifyMode(true);
        ui.startRealtimeCountdown(endTs);
        break;
      }
      case 'complete':
        ui.stopRealtimeCountdown();
        ui.setStatus('Getting your link…');
        break;
      case 'redirect':
        ui.setStatus('Redirecting you now…');
        break;
      case 'turnstile_error':
      case 'turnstile_expired':
        ui.setStatus('Verification glitched—wait a moment or refresh the page.');
        break;
      case 'error':
        ui.stopRealtimeCountdown();
        ui.setCountdown(null);
        ui.setCountHint(null);
        ui.setStatus('Could not finish');
        ui.setError(d.message ?? 'Unknown error');
        break;
    }
  };
  window.addEventListener('message', onMessage);
  try {
    ui.setStatus('Preparing…');
    const fingerprint = await xdmoviesFingerprint();
    ui.setStatus('Starting secure session…');
    chrome.runtime.sendMessage(
      {
        type: XDMOVIES_MAIN_WORLD_RUN,
        payload: { code, fingerprint, waitMs: SERVER_WAIT_MS, sitekey: TURNSTILE_SITEKEY, msgSource: MSG_SOURCE },
      },
      (resp: { ok?: boolean; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          ui.setStatus('Could not start');
          ui.setError(chrome.runtime.lastError.message ?? 'Extension messaging failed');
          window.removeEventListener('message', onMessage);
          return;
        }
        if (resp?.ok === false) {
          ui.setStatus('Could not start');
          ui.setError(resp.error ?? 'Could not inject on this page');
          window.removeEventListener('message', onMessage);
        }
      },
    );
  } catch (e) {
    ui.setStatus('Could not start');
    ui.setError(String(e instanceof Error ? e.message : e));
    window.removeEventListener('message', onMessage);
  }
}

function boot(): void {
  if (!PATH.test(location.pathname)) return;
  void runDirectFlow();
}

export function initXdmoviesLatestnewsAutomation(): void {
  if (window !== window.top) return;
  if (PATH.test(location.pathname)) {
    try {
      chrome.runtime.sendMessage({ type: MSG_VISIBILITY });
    } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
