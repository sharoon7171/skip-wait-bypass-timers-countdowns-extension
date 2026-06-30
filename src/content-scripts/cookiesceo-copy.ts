import { isAllowedHost } from '../utils/domain-check';
import { cardButton, createInlineCard } from '../injected-ui/card';

const HOSTS = ['cookiesceo.com'] as const;
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

  const card = createInlineCard({
    id: CARD_ID,
    badge: 'Skip Wait',
    title: 'Cookies ready',
    description: 'Timer skipped. Cookie loaded by the extension - copy below, no redirect.',
    status: 'Fetching…',
    actionsHtml: cardButton('skipwait-copy', 'Copy cookie'),
  });
  card.button('skipwait-copy')!.style.display = 'none';
  btn.parentElement.appendChild(card.root);
  card.root.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const copyBtn = card.button('skipwait-copy')!;
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
    card.setStatus('Download URL not found.', 'error');
    return;
  }

  try {
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    const html = await res.text();
    cookieText = extractCookie(html);
    if (cookieText) {
      card.setStatus('Ready. Click the button to copy.', 'success');
      copyBtn.style.display = 'inline-flex';
    } else {
      card.setStatus('Cookie not found on download page.', 'error');
    }
  } catch {
    card.setStatus('Failed to fetch cookie.', 'error');
  }
}

export function initCookiesceoCopy(): void {
  if (!isAllowedHost(HOSTS)) return;
  const exec = (): void => { run(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', exec);
  else exec();
}
