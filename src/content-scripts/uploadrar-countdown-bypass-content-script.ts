import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const HOSTS: readonly string[] = ['uploadrar.com'];
const CDN_LINK_RE = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s+here\s+to\s+download/i;
const FILE_SIZE_RE = /\bsize\s*:?\s*([\d.,]+\s*[KMGT]?B)/i;
const OVERLAY_ID = 'skip-wait-uploadrar-overlay';

const OVERLAY_CSS = `#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 0;box-sizing:border-box;background:rgba(15,23,42,.55);backdrop-filter:blur(2px) saturate(.85);-webkit-backdrop-filter:blur(2px) saturate(.85);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc}#${OVERLAY_ID} .sw-card{max-width:440px;width:100%;border-radius:16px;padding:24px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}#${OVERLAY_ID} .sw-badge{display:inline-block;margin:0 0 10px;padding:4px 10px;background:rgba(59,130,246,.18);color:#60a5fa;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;border:1px solid rgba(59,130,246,.35)}#${OVERLAY_ID} .sw-title{margin:0 0 12px;font-size:1.2rem;font-weight:700;color:#fff;letter-spacing:-.02em;line-height:1.25}#${OVERLAY_ID} .sw-file{margin:0 0 14px;padding:10px 12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:8px;font-size:.875rem;color:#cbd5e1;word-break:break-all}#${OVERLAY_ID} .sw-file b{color:#fff;font-weight:600}#${OVERLAY_ID} .sw-file span{color:#94a3b8;margin-left:8px;font-weight:500}#${OVERLAY_ID} .sw-status{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(15,23,42,.4);border-left:3px solid #60a5fa;border-radius:6px;font-size:.875rem;color:#cbd5e1}#${OVERLAY_ID} .sw-status.ok{border-left-color:#34d399;color:#a7f3d0}#${OVERLAY_ID} .sw-status.err{border-left-color:#f87171;color:#fecaca}#${OVERLAY_ID} .sw-spinner{flex:none;width:12px;height:12px;border:2px solid rgba(96,165,250,.3);border-top-color:#60a5fa;border-radius:50%;animation:sw-spin .8s linear infinite}#${OVERLAY_ID} .ok .sw-spinner,#${OVERLAY_ID} .err .sw-spinner{display:none}@keyframes sw-spin{to{transform:rotate(360deg)}}`;

const HTML_ESCAPES: Record<string, string> = { '"': '&quot;', '&': '&amp;', "'": '&#39;', '<': '&lt;', '>': '&gt;' };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function findForm(): HTMLFormElement | null {
  return document.querySelector<HTMLInputElement>('form input[name="op"][value^="download"]')?.form ?? null;
}

function showOverlay(name: string | null, size: string | null): (text: string, state?: 'ok' | 'err') => void {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  const fileBlock = name
    ? `<div class="sw-file"><b>${escapeHtml(name)}</b>${size ? `<span>${escapeHtml(size)}</span>` : ''}</div>`
    : '';
  root.innerHTML = `<style>${OVERLAY_CSS}</style><div class="sw-card"><div class="sw-badge">Skip Wait</div><div class="sw-title">Preparing your download</div>${fileBlock}<div class="sw-status"><div class="sw-spinner"></div><span class="sw-text">Generating direct link…</span></div></div>`;
  (document.body ?? document.documentElement).appendChild(root);
  const status = root.querySelector<HTMLElement>('.sw-status')!;
  const text = root.querySelector<HTMLElement>('.sw-text')!;
  return (msg, state) => {
    text.textContent = msg;
    status.className = state ? `sw-status ${state}` : 'sw-status';
  };
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
  const setStatus = showOverlay(name, size);
  const url = await fetchDirectLink(form);
  if (!url) return setStatus('Could not generate a direct link.', 'err');
  setStatus('Download started. You can close this tab.', 'ok');
  startDownload(url);
}

export function initUploadrarAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => void run());
}
