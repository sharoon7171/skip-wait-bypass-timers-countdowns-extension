import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['shrtslug.biz'] as const;
const FORM = 'form[action*="api-endpoint/verify"]';

let done = false;

function run(): void {
  if (done) return;
  const form = document.querySelector<HTMLFormElement>(FORM);
  if (!form) return;
  done = true;

  const body = new URLSearchParams();
  new FormData(form).forEach((v, k) => body.append(k, String(v)));
  const action = form.getAttribute('action') || `${location.origin}/api-endpoint/verify`;

  void fetch(action, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
    .then((r) => r.json())
    .then((d: { status?: string; data?: { final?: string } }) => {
      const u = d?.data?.final?.trim();
      if (d?.status === 'success' && /^https?:\/\//i.test(u ?? '')) location.replace(u!);
    })
    .catch(() => {});
}

export function initShrtslugRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(run);
}
