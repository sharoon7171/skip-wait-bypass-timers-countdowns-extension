import { isAllowedHost } from '../../utils/domain-check';

const HOSTS = [
  'onlinegiftools.com',
  'onlinejpgtools.com',
  'onlinepngtools.com',
  'onlinestringtools.com',
  'onlinetexttools.com',
  'onlinetools.com',
] as const;
const NOTICE_ID = 'skipwait-onlinetools-bypass';
const DATA_HIJACKED = 'data-skipwait-hijacked';
const SELECTORS = {
  canvas: '#tool-output .side-box',
  canvasData: 'canvas.data',
  canvasPreview: 'canvas.preview',
  copyBtn: '#tour-copy-clipboard',
  downloadBtn: '.widget[data-bs-target*="downloadModal"]',
  outputText: '#tool-output textarea.data',
  toolOutput: '#tool-output',
} as const;

function getCanvas(): HTMLCanvasElement | null {
  const out = document.querySelector(SELECTORS.canvas);
  return out
    ? (out.querySelector(SELECTORS.canvasData) ?? out.querySelector(SELECTORS.canvasPreview)) as HTMLCanvasElement | null
    : null;
}

function getOutputText(): string | null {
  const el = document.querySelector(SELECTORS.outputText);
  return el instanceof HTMLTextAreaElement && el.value.trim() ? el.value : null;
}

function getOutputExtension(): string {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('json')) return '.json';
  if (path.includes('csv')) return '.csv';
  return '.txt';
}

function toast(msg: string): void {
  if (!document.getElementById('skipwait-onlinetools-style')) {
    const s = document.createElement('style');
    s.id = 'skipwait-onlinetools-style';
    s.textContent = '@keyframes skipwait-fadein{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }
  document.getElementById('skipwait-onlinetools-toast')?.remove();
  const el = document.createElement('div');
  el.id = 'skipwait-onlinetools-toast';
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 16px;border-radius:8px;font-family:Poppins;font-size:14px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,.3);animation:skipwait-fadein .2s ease;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function triggerDownload(name: string, href: string, revoke = false): void {
  const a = document.createElement('a');
  a.download = name;
  a.href = href;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(href);
}

function hijack(btn: Element, fn: () => void): void {
  if (btn.hasAttribute(DATA_HIJACKED)) return;
  btn.setAttribute(DATA_HIJACKED, '1');
  btn.removeAttribute('data-bs-target');
  btn.removeAttribute('data-bs-toggle');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    fn();
  }, true);
}

function showBypassNotice(): void {
  document.getElementById(NOTICE_ID)?.remove();
  document.querySelector(`#tool-output #${NOTICE_ID}`)?.remove();
  const sides = document.querySelector('.sides-wrapper');
  if (!sides) return;
  const row = document.createElement('div');
  row.id = NOTICE_ID;
  row.className = 'row pt-3';
  const col = document.createElement('div');
  col.className = 'col-12';
  const notice = document.createElement('div');
  notice.className = 'alert border border-secondary rounded mb-0';
  notice.innerHTML =
    '<div class="d-flex flex-row"><div class="d-flex flex-column justify-content-center align-items-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-check-circle text-primary" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m10.97 4.97-.02.022-3.473 4.425-2.093-2.094a.75.75 0 0 0-1.08 1.037l2.5 2.5a.75.75 0 0 0 1.079-.02l4-5.5a.75.75 0 0 0-1.196-.92"/></svg></div><div class="ps-3"><div class="text-primary fw-bold">Wait timer bypassed</div><small>Skip Wait skipped the download wait timer. Copy and download are instant.</small></div></div>';
  col.append(notice);
  row.append(col);
  sides.after(row);
}

function run(): void {
  const toolOutput = document.querySelector(SELECTORS.toolOutput);
  const copyBtn = document.querySelector(SELECTORS.copyBtn);
  const downloadBtn = toolOutput?.querySelector(SELECTORS.downloadBtn);
  if (!toolOutput || !copyBtn) return;

  const host = window.location.host;
  const name = /^local/.test(host) ? host.split('.')[1] : host.split('.')[0];

  const download = (): void => {
    const c = getCanvas();
    if (c?.width) {
      triggerDownload(`output-${name}.png`, c.toDataURL('image/png'));
      toast('Download started');
      return;
    }
    const text = getOutputText();
    if (text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
      triggerDownload(`output-${name}${getOutputExtension()}`, url, true);
      toast('Download started');
      return;
    }
    toast('No output to download');
  };

  const copy = (): void => {
    const c = getCanvas();
    if (c?.width) {
      c.toBlob((b) => {
        if (b) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => toast('Copied to clipboard'), () => toast('Copy failed'));
      }, 'image/png');
      return;
    }
    const text = getOutputText();
    if (text) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard'), () => toast('Copy failed'));
    else toast('No output to copy');
  };

  hijack(copyBtn, copy);
  if (downloadBtn) hijack(downloadBtn, download);
  showBypassNotice();
}

export function initOnlinetoolsDirectDownload(): void {
  if (!isAllowedHost(HOSTS)) return;
  const check = (): void => {
    const toolOutput = document.querySelector(SELECTORS.toolOutput);
    if (!toolOutput) return;
    run();
    const cb = document.querySelector(SELECTORS.copyBtn);
    const db = toolOutput.querySelector(SELECTORS.downloadBtn);
    if (cb?.hasAttribute(DATA_HIJACKED) && (!db || db.hasAttribute(DATA_HIJACKED))) observer.disconnect();
  };
  const observer = new MutationObserver(check);
  const start = (): void => {
    check();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
