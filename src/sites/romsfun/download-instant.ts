import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { ROMSFUN_HOSTS } from './hosts';

const NOTICE_ID = 'skipwait-romsfun-bypass';

type AjaxJson = {
  success?: boolean;
  data?: { html?: string };
};

function downloadContainer(): HTMLElement | null {
  return document.getElementById('download-container');
}

function isCountdownPage(): boolean {
  return !!downloadContainer() && !!document.getElementById('countdown');
}

function showNotice(before: Element, text: string): void {
  let el = document.getElementById(NOTICE_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = NOTICE_ID;
    el.className =
      'help-block flex items-center justify-center px-4 py-3 bg-romfun-pink/10 mb-4 rounded-lg';
    const label = document.createElement('span');
    label.className = 'text-sm text-romfun-pink flex items-center font-semibold';
    el.append(label);
    before.before(el);
  }
  const label = el.querySelector('span');
  if (label) label.textContent = text;
}

function revealExistingButton(): boolean {
  const btn = document.getElementById('download-button');
  if (!btn) return false;
  btn.classList.remove('hidden');
  document.getElementById('download-loading')?.classList.add('hidden');
  return true;
}

function applyDownloadHtml(html: string): boolean {
  const box = downloadContainer();
  if (!box) return false;
  box.innerHTML = html;
  showNotice(box, 'Skip Wait skipped the wait timer. Your download is ready.');
  return true;
}

async function resolveAndShow(): Promise<void> {
  const box = downloadContainer();
  if (!box) return;
  showNotice(box, 'Skip Wait skipped the wait timer. Preparing your download…');
  document.getElementById('download-loading')?.classList.add('hidden');

  const ajaxUrl = box.getAttribute('data-ajax-url') || `${location.origin}/wp-admin/admin-ajax.php`;
  try {
    const res = await fetch(ajaxUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ action: 'k_get_download' }),
    });
    if (!res.ok) throw new Error('ajax');
    const j = (await res.json()) as AjaxJson;
    if (j.success && j.data?.html && applyDownloadHtml(j.data.html)) return;
  } catch {}
  if (revealExistingButton()) {
    showNotice(box, 'Skip Wait skipped the wait timer. Your download is ready.');
  }
}

export function initRomsfunDownloadInstant(): void {
  if (!isAllowedHost(ROMSFUN_HOSTS)) return;
  whenDomParsed(() => {
    if (!isCountdownPage()) return;
    void resolveAndShow();
  });
}
