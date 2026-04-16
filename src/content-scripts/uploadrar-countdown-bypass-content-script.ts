const CDN_LINK_RE = /<a\s+[^>]*href=["'](https?:\/\/[^"']+\/[^"']+\.[A-Za-z0-9]+(?:\?[^"']*)?)["'][^>]*>\s*(?:<[^>]*>\s*)*Click\s+here\s+to\s+download/i;
const FORM_OP_SELECTOR = 'form input[name="op"][value^="download"]';
const CAPTCHA_SELECTORS = ['.cf-turnstile', '.g-recaptcha', '.h-captcha', '[data-sitekey]'].join(',');
const FILE_NAME_SELECTORS = ['#file-name', '.download-title', 'h1.download-title'];
const FILE_NAME_TEXT_RE = /file\s*name\s*:?\s*([^\n\r<]{2,200}?)(?=\s*(?:file\s*size|\n|$))/i;
const FILE_SIZE_RE = /(?:file\s*)?size\s*:?\s*([\d.,]+\s*(?:[KMGT]?B))/i;
const TITLE_PREFIX_RE = /^download\s+/i;
const OVERLAY_ID = 'skip-wait-uploadrar-overlay';

interface FileInfo {
  name: string | null;
  size: string | null;
}

interface Overlay {
  error: (text: string) => void;
  info: (text: string) => void;
  success: (text: string) => void;
}

function overlayCss(): string {
  const o = OVERLAY_ID;
  return `#${o}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:flex-start;justify-content:center;padding:16px 20px 0;box-sizing:border-box;background:rgba(15,23,42,.55);backdrop-filter:blur(2px) saturate(.85);-webkit-backdrop-filter:blur(2px) saturate(.85);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f8fafc}#${o} .sw-card{max-width:440px;width:100%;border-radius:16px;padding:24px;background:linear-gradient(145deg,#1e293b 0%,#0f172a 100%);border:1px solid rgba(148,163,184,.25);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}#${o} .sw-badge{display:inline-block;margin:0 0 10px;padding:4px 10px;background:rgba(59,130,246,.18);color:#60a5fa;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;border:1px solid rgba(59,130,246,.35)}#${o} .sw-title{margin:0 0 8px;font-size:1.2rem;font-weight:700;color:#fff;letter-spacing:-.02em;line-height:1.25}#${o} .sw-file{margin:0 0 12px;padding:10px 12px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:8px;font-size:.875rem;color:#cbd5e1;word-break:break-all}#${o} .sw-file-label{display:block;color:#94a3b8;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}#${o} .sw-file-name{color:#fff;font-weight:600}#${o} .sw-file-size{color:#94a3b8;margin-left:8px;font-weight:500}#${o} .sw-note{margin:0 0 14px;font-size:.875rem;line-height:1.55;color:#94a3b8}#${o} .sw-note strong{color:#cbd5e1;font-weight:600}#${o} .sw-status{display:flex;align-items:center;gap:8px;margin:0;padding:10px 12px;background:rgba(15,23,42,.4);border-left:3px solid #60a5fa;border-radius:6px;font-size:.875rem;color:#cbd5e1}#${o} .sw-status.sw-success{border-left-color:#34d399;color:#a7f3d0}#${o} .sw-status.sw-error{border-left-color:#f87171;color:#fecaca}#${o} .sw-spinner{flex:none;width:12px;height:12px;border:2px solid rgba(96,165,250,.3);border-top-color:#60a5fa;border-radius:50%;animation:sw-spin .8s linear infinite}#${o} .sw-success .sw-spinner,#${o} .sw-error .sw-spinner{display:none}@keyframes sw-spin{to{transform:rotate(360deg)}}`;
}

function findForm(): HTMLFormElement | null {
  for (const op of document.querySelectorAll<HTMLInputElement>(FORM_OP_SELECTOR)) {
    const form = op.form;
    if (!form || form.querySelector(CAPTCHA_SELECTORS)) continue;
    const id = form.querySelector<HTMLInputElement>('input[name="id"]');
    if (id?.value?.trim()) return form;
  }
  return null;
}

function readFileInfo(form: HTMLFormElement): FileInfo {
  const fname = form.querySelector<HTMLInputElement>('input[name="fname"]')?.value?.trim();
  const bodyText = document.body?.textContent ?? '';
  let name: string | null = fname || null;
  if (!name) {
    for (const sel of FILE_NAME_SELECTORS) {
      const text = document.querySelector(sel)?.textContent?.trim();
      if (text) {
        name = text;
        break;
      }
    }
  }
  if (!name) name = bodyText.match(FILE_NAME_TEXT_RE)?.[1]?.trim() ?? null;
  if (!name) name = document.title.replace(TITLE_PREFIX_RE, '').trim() || null;
  const size = bodyText.match(FILE_SIZE_RE)?.[1]?.trim() ?? null;
  return { name, size };
}

function createOverlay(file: FileInfo): Overlay {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  const style = document.createElement('style');
  style.textContent = overlayCss();
  root.appendChild(style);
  const card = document.createElement('div');
  card.className = 'sw-card';
  const badge = document.createElement('div');
  badge.className = 'sw-badge';
  badge.textContent = 'Skip Wait';
  const title = document.createElement('div');
  title.className = 'sw-title';
  title.textContent = 'Preparing your download';
  card.append(badge, title);
  if (file.name) {
    const fileBox = document.createElement('div');
    fileBox.className = 'sw-file';
    const label = document.createElement('span');
    label.className = 'sw-file-label';
    label.textContent = 'File';
    const name = document.createElement('span');
    name.className = 'sw-file-name';
    name.textContent = file.name;
    fileBox.append(label, name);
    if (file.size) {
      const size = document.createElement('span');
      size.className = 'sw-file-size';
      size.textContent = file.size;
      fileBox.append(size);
    }
    card.appendChild(fileBox);
  }
  const note = document.createElement('div');
  note.className = 'sw-note';
  note.innerHTML =
    '<strong>Skipping the countdown and intermediate page.</strong> We&rsquo;re asking the server for the real CDN link directly &mdash; no extra clicks, no second page, no ads to dismiss.';
  const status = document.createElement('div');
  status.className = 'sw-status';
  const spinner = document.createElement('div');
  spinner.className = 'sw-spinner';
  const text = document.createElement('span');
  text.className = 'sw-text';
  text.textContent = 'Generating direct link…';
  status.append(spinner, text);
  card.append(note, status);
  root.appendChild(card);
  (document.body ?? document.documentElement).appendChild(root);
  const set = (t: string, state: '' | 'sw-success' | 'sw-error'): void => {
    text.textContent = t;
    status.className = state ? `sw-status ${state}` : 'sw-status';
  };
  return {
    error: (t) => set(t, 'sw-error'),
    info: (t) => set(t, ''),
    success: (t) => set(t, 'sw-success'),
  };
}

function buildPayload(form: HTMLFormElement): FormData {
  const fd = new FormData(form);
  fd.set('op', 'download2');
  if (!fd.has('rand')) fd.set('rand', '');
  if (!fd.has('method_free')) fd.set('method_free', 'Free Download');
  return fd;
}

async function fetchDirectLink(form: HTMLFormElement): Promise<string | null> {
  const res = await fetch(form.action || window.location.href, { body: buildPayload(form), method: 'POST' });
  if (!res.ok) return null;
  return (await res.text()).match(CDN_LINK_RE)?.[1]?.trim() ?? null;
}

function startDownload(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function waitForForm(): Promise<HTMLFormElement | null> {
  return new Promise((resolve) => {
    const existing = findForm();
    if (existing) return resolve(existing);
    const finish = (form: HTMLFormElement | null): void => {
      mo.disconnect();
      document.removeEventListener('readystatechange', onState);
      resolve(form);
    };
    const onState = (): void => {
      if (document.readyState === 'complete') finish(findForm());
    };
    const mo = new MutationObserver(() => {
      const f = findForm();
      if (f) finish(f);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('readystatechange', onState);
  });
}

async function run(): Promise<void> {
  const form = await waitForForm();
  if (!form) return;
  const overlay = createOverlay(readFileInfo(form));
  const link = await fetchDirectLink(form);
  if (!link) return overlay.error('Could not generate a direct link. Try the page’s normal download button.');
  overlay.success('Download started. You can close this tab once your browser begins saving the file.');
  startDownload(link);
}

export function initUploadrarAutomation(): void {
  void run();
}
