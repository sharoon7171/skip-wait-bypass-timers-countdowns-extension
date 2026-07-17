import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['usersdrive.com'] as const;
const NOTICE_ID = 'skipwait-usersdrive-bypass';
const TURNSTILE_RESPONSE = '[name="cf-turnstile-response"]';
const CDN_HREF_RE = /href=["']\s*(https?:\/\/[^"']*userdrive\.org[^"']*)["']/i;

function download2Form(): HTMLFormElement | null {
  const op = document.querySelector<HTMLInputElement>('input[name="op"][value="download2"]');
  return op?.form ?? null;
}

function downloadBtn(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('#downloadbtn');
}

function pickDirectFromHtml(html: string): string | null {
  const url = html.match(CDN_HREF_RE)?.[1]?.trim();
  return url?.startsWith('http') ? url : null;
}

function existingDirectUrl(): string | null {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a.btn.btn-download[href]')) {
    const href = a.getAttribute('href')?.trim() ?? '';
    if (/userdrive\.org/i.test(href)) return href;
  }
  return null;
}

function setStatus(text: string): void {
  const turnstile = document.querySelector('.cf-turnstile');
  const mount = turnstile?.parentElement ?? document.querySelector('.dl') ?? document.querySelector('.down');
  if (!mount) return;
  let wrap = document.getElementById(NOTICE_ID);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = NOTICE_ID;
    wrap.className = 'name';
    wrap.style.marginBottom = '12px';
    const title = document.createElement('h4');
    const icon = document.createElement('i');
    icon.className = 'la la-check';
    icon.style.color = '#f7527c';
    title.append(icon, document.createTextNode(' Skip Wait'));
    const detail = document.createElement('small');
    detail.id = `${NOTICE_ID}-text`;
    wrap.append(title, detail);
    if (turnstile) turnstile.parentNode?.insertBefore(wrap, turnstile);
    else mount.prepend(wrap);
  }
  const detail = document.getElementById(`${NOTICE_ID}-text`);
  if (detail) detail.textContent = text;
}

function setBtnEnabled(enabled: boolean): void {
  const btn = downloadBtn();
  if (!btn) return;
  btn.disabled = !enabled;
  btn.classList.toggle('disabled', !enabled);
}

function waitTurnstile(form: HTMLFormElement, ms = 90_000): Promise<boolean> {
  if (!form.querySelector(`.cf-turnstile, ${TURNSTILE_RESPONSE}`)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = (): void => {
      const token = form
        .querySelector<HTMLInputElement | HTMLTextAreaElement>(TURNSTILE_RESPONSE)
        ?.value?.trim();
      if (token && token.length > 20) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= ms) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

async function resolveDirectUrl(form: HTMLFormElement): Promise<string | null> {
  if (!(await waitTurnstile(form))) return null;
  const body = new URLSearchParams();
  for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[name], textarea[name]',
  )) {
    body.append(el.name, el.value);
  }
  const res = await fetch(location.href, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) return null;
  return pickDirectFromHtml(await res.text());
}

function wireDirectClick(url: string): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as Element | null)?.closest('#downloadbtn, a.btn.btn-download');
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign(url);
    },
    true,
  );
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a.btn.btn-download[href]')) {
    a.setAttribute('href', url);
    a.removeAttribute('target');
  }
}

async function runTimerPage(form: HTMLFormElement): Promise<void> {
  document.querySelector('.countdown')?.remove();
  setBtnEnabled(false);
  setStatus('Skipped the wait timer. Finishing verification…');

  const url = await resolveDirectUrl(form);
  if (!url) {
    setBtnEnabled(true);
    setStatus('Skipped the wait timer. Complete the check below, then click Create Download Link.');
    return;
  }

  wireDirectClick(url);
  setBtnEnabled(true);
  setStatus('Your download is ready. Click Create Download Link.');
}

export function initUsersdriveAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    const existing = existingDirectUrl();
    if (existing) {
      wireDirectClick(existing);
      setStatus('Your download is ready. Click Download.');
      return;
    }
    const form = download2Form();
    if (!form || !downloadBtn()) return;
    void runTimerPage(form);
  });
}
