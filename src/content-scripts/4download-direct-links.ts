import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS = ['4download.net'] as const;
const PROVIDER_IDS = [
  'gdrive',
  'mediafire',
  'dropbox',
  'onedrive',
  'pixeldrain',
  'gofile',
  'usersdrive',
  'torrent',
  'cloud',
  'box',
  'vikingfile',
];
const OKE_LINK_ID = 'oke-link';
const DOWNLOAD_BUTTONS_ID = 'downloadButtons';
const LOADING_TEXT_ID = 'loadingText';
const OKE_LINK_HREF_RE = /<a\b[^>]*\bid=["']oke-link["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<a\b[^>]*\bhref=["']([^"']+)["'][^>]*\bid=["']oke-link["'][^>]*>/i;

function hasDownloadView(): boolean {
  if (document.getElementById(DOWNLOAD_BUTTONS_ID)) return true;
  for (const id of PROVIDER_IDS) if (document.getElementById(id)) return true;
  return false;
}

function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function isHrefSafe(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function rewriteProviderButtons(): boolean {
  let any = false;
  for (const id of PROVIDER_IDS) {
    const btn = document.getElementById(id) as HTMLAnchorElement | null;
    if (!btn) continue;
    const link = btn.getAttribute('data-link');
    if (!isHttpUrl(link)) continue;
    if (btn.getAttribute('href') !== link) btn.href = link;
    btn.target = '_blank';
    btn.rel = 'noreferrer noopener';
    if (btn.onclick) btn.onclick = null;
    any = true;
  }
  return any;
}

function revealDownloadButtons(): void {
  document.getElementById(DOWNLOAD_BUTTONS_ID)?.classList.add('show');
  const loading = document.getElementById(LOADING_TEXT_ID);
  if (loading) loading.style.display = 'none';
  document.querySelector<HTMLElement>('.circle')?.style.setProperty('display', 'none');
  document.querySelector<HTMLElement>('.progress')?.style.setProperty('display', 'none');
}

function runDownloadView(): void {
  let revealed = false;
  const apply = (): void => {
    const ok = rewriteProviderButtons();
    if (ok && !revealed) {
      revealDownloadButtons();
      revealed = true;
    }
  };
  const obs = new MutationObserver(apply);
  obs.observe(document.body ?? document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-link', 'style', 'class', 'href'],
  });
  apply();
  setTimeout(apply, 1500);
  setTimeout(() => {
    apply();
    if (revealed) obs.disconnect();
  }, 4500);
}

function applyOkeHref(href: string): void {
  const a = document.getElementById(OKE_LINK_ID) as HTMLAnchorElement | null;
  if (!a) return;
  if (a.getAttribute('href') === href) return;
  a.setAttribute('href', href);
  a.style.cursor = 'pointer';
}

function pickOkeHrefFromHtml(html: string): string | null {
  const m = html.match(OKE_LINK_HREF_RE);
  const raw = m?.[1] ?? m?.[2] ?? null;
  if (!raw) return null;
  const decoded = raw.replace(/&amp;/g, '&');
  return isHrefSafe(decoded) ? decoded : null;
}

function runArticleView(): void {
  const a = document.getElementById(OKE_LINK_ID) as HTMLAnchorElement | null;
  if (!a) return;
  const existing = a.getAttribute('href');
  if (isHrefSafe(existing)) {
    applyOkeHref(existing);
    return;
  }
  fetch(window.location.href, { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      const href = pickOkeHrefFromHtml(html);
      if (href) applyOkeHref(href);
    })
    .catch(() => {});
}

export function initFourDownloadDirectLinks(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    if (hasDownloadView()) runDownloadView();
    if (document.getElementById(OKE_LINK_ID)) runArticleView();
  });
}
