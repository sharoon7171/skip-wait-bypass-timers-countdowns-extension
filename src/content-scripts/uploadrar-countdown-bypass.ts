import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { getHostsByKey } from '../utils/remote-domains';
import { createStatusOverlay } from '../injected-ui/status-overlay';

const KEY = 'uploadrar-countdown-bypass';
const CDN_LINK_RE = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s+here\s+to\s+download/i;
const FILE_SIZE_RE = /\bsize\s*:?\s*([\d.,]+\s*[KMGT]?B)/i;
const OVERLAY_ID = 'skip-wait-uploadrar-overlay';

function findForm(): HTMLFormElement | null {
  return document.querySelector<HTMLInputElement>('form input[name="op"][value^="download"]')?.form ?? null;
}

async function fetchDirectLink(form: HTMLFormElement): Promise<string | null> {
  const fd = new FormData(form);
  fd.set('op', 'download2');
  fd.set('method_free', 'Free Download');
  fd.set('rand', '');
  const res = await fetch(form.action || location.href, { body: fd, method: 'POST' });
  if (!res.ok) return null;
  return (await res.text()).match(CDN_LINK_RE)?.[1]?.trim() ?? null;
}

function startDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function run(): Promise<void> {
  const form = findForm();
  if (!form) return;
  const name = form.querySelector<HTMLInputElement>('input[name="fname"]')?.value?.trim() || null;
  const size = document.body?.textContent?.match(FILE_SIZE_RE)?.[1]?.trim() ?? null;
  const overlay = createStatusOverlay({
    id: OVERLAY_ID,
    file: name ? { name, size } : null,
  });
  const url = await fetchDirectLink(form);
  if (!url) return overlay.setStatus('Could not generate a direct link.', 'err');
  overlay.setStatus('Download started. You can close this tab.', 'ok');
  startDownload(url);
}

export function initUploadrarAutomation(): void {
  if (!isAllowedHost(getHostsByKey(KEY))) return;
  whenDomParsed(() => void run());
}
