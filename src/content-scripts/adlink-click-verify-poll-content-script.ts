import { whenDomParsed } from '../utils/domain-check';

const ADLINK_CLICK_VERIFY_PATH = '/verify.php';

const ADLINK_CLICK_VERIFY_SERVER_READY_MS = 7000;

function isAdlinkClickVerifyShell(): boolean {
  if (
    !document.querySelector('#skip-btn') ||
    !document.querySelector('#timer') ||
    !document.querySelector('#captchaForm')
  ) {
    return false;
  }
  return [...document.querySelectorAll('script:not([src])')].some((el) => {
    const t = el.textContent || '';
    return t.includes('verify.php') && t.includes('check.php');
  });
}

function isAdlinkClickHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith('http://') || t.startsWith('https://');
}

async function pollAdlinkClickVerify(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ADLINK_CLICK_VERIFY_SERVER_READY_MS));
  const verifyHref = new URL(ADLINK_CLICK_VERIFY_PATH, window.location.origin).href;
  for (;;) {
    const r = await fetch(verifyHref, { credentials: 'same-origin' });
    const text = await r.text();
    let data: { status?: unknown; url?: unknown };
    try {
      data = JSON.parse(text) as { status?: unknown; url?: unknown };
    } catch {
      continue;
    }
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    if (data.status === 'ok' && url && isAdlinkClickHttpUrl(url)) {
      window.location.replace(url);
      return;
    }
  }
}

export function initAdlinkClickVerifyPoll(): void {
  whenDomParsed(() => {
    if (!isAdlinkClickVerifyShell()) return;
    void pollAdlinkClickVerify();
  });
}
