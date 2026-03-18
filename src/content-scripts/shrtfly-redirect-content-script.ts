import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['shrtslug.biz'];
const VERIFY_SELECTOR = 'form[action*="api-endpoint/verify"]';

let done = false;

function run(): void {
  if (done) return;
  const form = document.querySelector<HTMLFormElement>(VERIFY_SELECTOR);
  if (!form) return;
  done = true;

  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, String(v)));
  const action = typeof form.action === 'string' ? form.action : form.getAttribute('action') ?? '';
  const url = action.startsWith('http') ? action : new URL(action || '/api-endpoint/verify', location.origin).href;

  fetch(url, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then((r) => r.json())
    .then((d: { status?: string; data?: { final?: string } }) => {
      const u = d?.data?.final?.trim();
      if (d?.status === 'success' && u && (u.startsWith('http://') || u.startsWith('https://'))) location.href = u;
    })
    .catch(() => {});
}

export function initShrtflyRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', run) : run();
}
