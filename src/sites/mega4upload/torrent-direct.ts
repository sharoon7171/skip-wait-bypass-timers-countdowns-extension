import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['mega4upload.net'] as const;
const TRACKER = 'https://mega4upload.net/cgi-bin/tracker.cgi';
const FILE_PATH_RE = /^\/([a-z0-9]+)\/?$/i;
const RESERVED = new Set([
  'admin', 'banners', 'change_lang', 'contact', 'dashboard', 'login',
  'make_money', 'mass_dmca', 'monitor', 'payment_proof', 'premium',
  'register', 'report_files',
]);
const BRAND_ID = 'skipwait-mega4upload';

function directUrlFromTorrent(torrent: ArrayBuffer): string | null {
  const text = new TextDecoder('latin1').decode(new Uint8Array(torrent));
  const at = text.indexOf('8:url-list');
  const len = at === -1 ? null : text.slice(at + 10).match(/^(\d+):/);
  if (!len?.[1]) return null;
  const start = at + 10 + len[0].length;
  const url = text.slice(start, start + Number(len[1]));
  return url.startsWith('https://') ? url : null;
}

function fileCode(): string | null {
  const id = document.querySelector<HTMLInputElement>('input[name="id"]')?.value.trim();
  if (id) return id;
  const segment = location.pathname.match(FILE_PATH_RE)?.[1]?.toLowerCase();
  return segment && !RESERVED.has(segment) ? segment : null;
}

async function resolveDirectUrl(code: string): Promise<string | null> {
  const res = await fetch(`${TRACKER}?file_code=${encodeURIComponent(code)}`, {
    credentials: 'include',
  });
  return res.ok ? directUrlFromTorrent(await res.arrayBuffer()) : null;
}

function showBanner(anchor: Element | null, detail: string): void {
  if (!anchor || document.getElementById(BRAND_ID)) return;
  const banner = Object.assign(document.createElement('div'), {
    id: BRAND_ID,
    innerHTML:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' +
      `<div><div style="font-weight:700;font-size:15px;letter-spacing:-.01em">Skip Wait — timer bypassed</div><div style="font-size:12.5px;opacity:.92;margin-top:2px">${detail}</div></div>`,
  });
  banner.style.cssText =
    'display:flex;align-items:center;gap:12px;margin:0 0 16px;padding:12px 16px;border-radius:12px;' +
    'background:linear-gradient(135deg,#10b981,#059669);color:#fff;box-shadow:0 6px 18px rgba(16,185,129,.35);' +
    'font-family:Inter,Manrope,system-ui,-apple-system,sans-serif';
  anchor.before(banner);
}

function unlockTimerUi(): void {
  document.getElementById('countdown')?.remove();
  const btn = document.querySelector<HTMLButtonElement>('#downloadbtn');
  if (btn) {
    btn.disabled = false;
    btn.classList.add('is-ready');
  }
}

function wire(direct: Promise<string | null>): void {
  const timerPage = !!document.querySelector('input[name="op"][value="download2"]');
  if (timerPage) {
    unlockTimerUi();
    showBanner(
      document.querySelector('.dl-captcha') ?? document.querySelector('.dl-cta'),
      'Direct CDN link resolved — no countdown or captcha needed.',
    );
  } else {
    showBanner(
      document.querySelector('.dl-cta-row'),
      'Direct download is ready — click either button to skip the wait and ads.',
    );
  }

  const go = (e: Event): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
    void direct.then((url) => url && location.assign(url));
  };
  document.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element).closest('button.dl-btn--free[name="method_free"], #downloadbtn')) go(e);
    },
    true,
  );
  document.querySelector('form[name="F1"], form.dl-form')?.addEventListener('submit', go, true);
}

export function initMega4uploadBypass(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    const code = fileCode();
    if (code) wire(resolveDirectUrl(code));
  });
}
