import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import { SKIPWAIT_CARD_STYLES } from '../utils/skipwait-card-styles';

const KEY = 'cookiesceo-copy';
const CARD_ID = 'skipwait-cookiesceo-card';
const SESSION_PASTE_RE = /session_paste\s+([A-Za-z0-9+/=]+)/;
const DOWNLOAD_RE = /["']([^"']*-download)\/?"?["']/;

function getDownloadUrl(): string | null {
  const { origin } = window.location;
  for (const script of document.scripts) {
    const text = script.textContent ?? '';
    if (!/location\.(replace|href)|window\.location/.test(text)) continue;
    const m = text.match(DOWNLOAD_RE);
    if (!m?.[1]) continue;
    let u = m[1].trim();
    if (!/^https?:/i.test(u)) u = origin + (u.startsWith('/') ? u : '/' + u);
    if (!u.startsWith(origin) || /buy|product|notify/i.test(u)) continue;
    return u.endsWith('/') ? u : u + '/';
  }
  return null;
}

function extractCookie(html: string): string | null {
  const m = html.match(SESSION_PASTE_RE);
  return m ? `session_paste ${m[1]}` : null;
}

async function run(): Promise<void> {
  const btn = document.getElementById('download-btn');
  if (!btn?.parentElement || document.getElementById(CARD_ID)) return;

  const container = btn.parentElement;
  const s = SKIPWAIT_CARD_STYLES;
  const card = document.createElement('div');
  card.id = CARD_ID;
  card.setAttribute('style', s.card);
  card.innerHTML = [
    `<div style="${s.badge}">Skip Wait</div>`,
    `<h3 style="${s.title}">Cookies ready</h3>`,
    `<p style="${s.description}">Timer skipped. Cookie loaded by the extension - copy below, no redirect.</p>`,
    `<p style="${s.status}" id="skipwait-status">Fetching…</p>`,
    `<button type="button" style="${s.btn};display:none" id="skipwait-copy">Copy cookie</button>`,
  ].join('');
  container.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const status = document.getElementById('skipwait-status')!;
  const copyBtn = document.getElementById('skipwait-copy') as HTMLButtonElement;
  let cookieText: string | null = null;

  copyBtn.onclick = async () => {
    if (!cookieText) return;
    try {
      await navigator.clipboard.writeText(cookieText);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy cookie'; }, 2000);
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
  };

  const url = getDownloadUrl();
  if (!url) {
    status.setAttribute('style', s.statusError);
    status.textContent = 'Download URL not found.';
    return;
  }

  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    const html = await res.text();
    cookieText = extractCookie(html);
    if (cookieText) {
      status.setAttribute('style', s.statusSuccess);
      status.textContent = 'Ready. Click the button to copy.';
      copyBtn.style.display = 'inline-flex';
    } else {
      status.setAttribute('style', s.statusError);
      status.textContent = 'Cookie not found on download page.';
    }
  } catch {
    status.setAttribute('style', s.statusError);
    status.textContent = 'Failed to fetch cookie.';
  }
}

export function initCookiesceoCopy(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  const exec = (): void => { run(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', exec);
  else exec();
}
