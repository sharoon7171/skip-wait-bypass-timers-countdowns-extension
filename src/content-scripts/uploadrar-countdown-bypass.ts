import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS = ['uploadrar.com'] as const;
const CDN_LINK_RE = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s+here\s+to\s+download/i;

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
  const url = await fetchDirectLink(form);
  if (url) startDownload(url);
}

export function initUploadrarAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => void run());
}
