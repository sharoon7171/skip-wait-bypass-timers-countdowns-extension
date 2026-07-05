import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['wahmi.org'] as const;
const FILE_PATH_RE = /^\/([^/]+)\/file\/?$/i;
const NOTICE_ID = 'skipwait-wahmi-bypass';

async function resolveDownload(fileId: string): Promise<string | null> {
  const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
  if (!csrf) return null;
  const res = await fetch(`${location.origin}/${encodeURIComponent(fileId)}/download/create`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-TOKEN': csrf, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { error?: unknown; download_link?: string };
  return data.error || typeof data.download_link !== 'string' ? null : data.download_link;
}

function showNotice(): void {
  const filebox = document.querySelector('.filebox');
  if (!filebox || document.getElementById(NOTICE_ID)) return;
  const notice = Object.assign(document.createElement('div'), {
    id: NOTICE_ID,
    textContent: 'Skip Wait bypassed the download timer.',
  });
  notice.style.cssText =
    'display:block;width:100%;box-sizing:border-box;padding:12px 20px;' +
    'border-bottom:1px solid rgba(16,185,129,.25);background:#ecfdf5;color:#047857;font-size:13px;';
  filebox.prepend(notice);
}

async function run(): Promise<void> {
  const fileId = location.pathname.match(FILE_PATH_RE)?.[1];
  const box = document.querySelector('.filebox-download');
  if (!fileId || !box || !document.querySelector('.download-counter')) return;
  document.querySelector('.download-counter')?.remove();
  showNotice();
  const url = await resolveDownload(fileId);
  if (!url) return;
  box.innerHTML = `<a class="download-link" href="${url}">Download</a>`;
}

export function initWahmiCountdownBypass(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => void run());
}
