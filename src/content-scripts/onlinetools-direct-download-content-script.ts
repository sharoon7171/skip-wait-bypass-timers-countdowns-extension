import { isAllowedHost } from '../utils/domain-check';
import { SKIPWAIT_CARD_STYLES } from '../utils/skipwait-card-styles';

const ALLOWED_HOSTS = [
  'onlinegiftools.com',
  'onlinejpgtools.com',
  'onlinepngtools.com',
  'onlinestringtools.com',
  'onlinetexttools.com',
  'onlinetools.com',
];
const CARD_ID = 'skipwait-onlinetools-card';
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

function run(): void {
  const toolOutput = document.querySelector(SELECTORS.toolOutput);
  const twoColRow = toolOutput?.parentElement;
  const copyBtn = document.querySelector(SELECTORS.copyBtn);
  const downloadBtn = toolOutput?.querySelector(SELECTORS.downloadBtn);
  if (!twoColRow || !copyBtn) return;

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

  if (!document.getElementById(CARD_ID)) {
    const s = SKIPWAIT_CARD_STYLES;
    const card = document.createElement('div');
    card.id = CARD_ID;
    card.setAttribute('style', s.card);
    card.innerHTML = `<div style="${s.badge}">Skip Wait extension</div><p style="${s.description}">We made the <strong>Copy</strong> and <strong>Download</strong> buttons work in one click - no pop-ups, no waiting. Just use the buttons below.</p>`;
    twoColRow.insertBefore(card, twoColRow.firstChild);
  }

  hijack(copyBtn, copy);
  if (downloadBtn) hijack(downloadBtn, download);
}

export function initOnlinetoolsDirectDownload(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  const check = (): void => {
    const toolOutput = document.querySelector(SELECTORS.toolOutput);
    if (!toolOutput) return;
    run();
    const cb = document.querySelector(SELECTORS.copyBtn);
    const db = toolOutput.querySelector(SELECTORS.downloadBtn);
    if (document.getElementById(CARD_ID) && cb?.hasAttribute(DATA_HIJACKED) && (!db || db.hasAttribute(DATA_HIJACKED))) observer.disconnect();
  };
  const observer = new MutationObserver(check);
  const start = (): void => {
    check();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
