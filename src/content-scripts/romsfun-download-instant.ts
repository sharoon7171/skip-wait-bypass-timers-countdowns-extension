import { isAllowedHost } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';

const KEY = 'romsfun-download-instant';

type AjaxJson = {
  success?: boolean;
  data?: { download_url?: string; html?: string };
};

function isDownloadPage(): boolean {
  try {
    return /\/download\//i.test(location.pathname);
  } catch {
    return false;
  }
}

function pickFileUrl(d: { download_url?: string; html?: string }): string | null {
  const u = d.download_url;
  if (u && /^https?:\/\//i.test(u)) return u;
  const m = d.html?.match(/href="([^"]+\.zip[^"]*)"/i);
  return m?.[1]?.replace(/\\\//g, '/') ?? null;
}

function bindUrl(url: string): boolean {
  const a = document.getElementById('download-link');
  if (!(a instanceof HTMLAnchorElement)) return false;
  a.setAttribute('href', url);
  const btn = document.getElementById('download-button');
  if (btn) {
    btn.classList.remove('hidden');
    btn.style.removeProperty('display');
  }
  document.getElementById('download-loading')?.setAttribute('style', 'display:none');
  return true;
}

function bindUrlWhenReady(url: string): void {
  if (bindUrl(url)) return;
  const mo = new MutationObserver(() => {
    if (bindUrl(url)) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 15000);
}

function hideSpinnerIfPresent(): void {
  document.getElementById('download-loading')?.setAttribute('style', 'display:none');
}

export function initRomsfunDownloadInstant(): void {
  if (!isAllowedHost(getHostsByKey(KEY)) || !isDownloadPage()) return;

  hideSpinnerIfPresent();
  const mo = new MutationObserver(hideSpinnerIfPresent);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => mo.disconnect(), 20000);

  const fd = new FormData();
  fd.append('action', 'k_get_download');
  void fetch(`${location.origin}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    body: fd,
    credentials: 'include',
  })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j: AjaxJson) => {
      const url = j.success && j.data ? pickFileUrl(j.data) : null;
      if (url) bindUrlWhenReady(url);
    })
    .catch(() => {});
}
