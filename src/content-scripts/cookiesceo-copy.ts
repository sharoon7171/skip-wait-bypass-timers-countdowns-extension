import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['cookiesceo.com'] as const;
const ACTIONS_ID = 'skipwait-cookiesceo-actions';
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
  if (!btn?.parentElement || document.getElementById(ACTIONS_ID)) return;

  const wrap = document.createElement('div');
  wrap.id = ACTIONS_ID;
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.id = 'skipwait-copy';
  copyBtn.textContent = 'Copy cookie';
  copyBtn.style.display = 'none';
  wrap.appendChild(copyBtn);
  btn.parentElement.appendChild(wrap);

  let cookieText: string | null = null;
  copyBtn.onclick = async () => {
    if (!cookieText) return;
    try {
      await navigator.clipboard.writeText(cookieText);
      copyBtn.textContent = 'Copied';
      setTimeout(() => {
        copyBtn.textContent = 'Copy cookie';
      }, 2000);
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
  };

  const url = getDownloadUrl();
  if (!url) return;

  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    const html = await res.text();
    cookieText = extractCookie(html);
    if (cookieText) {
      copyBtn.style.display = 'inline-block';
      try {
        await navigator.clipboard.writeText(cookieText);
      } catch {}
    }
  } catch {}
}

export function initCookiesceoCopy(): void {
  if (!isAllowedHost(HOSTS)) return;
  const exec = (): void => {
    run();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', exec);
  else exec();
}
