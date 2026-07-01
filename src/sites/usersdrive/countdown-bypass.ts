import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['usersdrive.com'] as const;
const NOTICE_ID = 'skipwait-usersdrive-bypass';

function showBypassNotice(): void {
  if (document.getElementById(NOTICE_ID)) return;
  const turnstile = document.querySelector('.cf-turnstile');
  if (!turnstile) return;
  const wrap = document.createElement('div');
  wrap.id = NOTICE_ID;
  wrap.className = 'name';
  wrap.style.marginBottom = '12px';
  const title = document.createElement('h4');
  const icon = document.createElement('i');
  icon.className = 'la la-check';
  icon.style.color = '#f7527c';
  title.append(icon, document.createTextNode(' Countdown bypassed'));
  const detail = document.createElement('small');
  detail.textContent =
    'Skip Wait skipped the wait timer. Complete the check below and click Create Download Link.';
  wrap.append(title, detail);
  turnstile.parentNode?.insertBefore(wrap, turnstile);
}

function unlock(): void {
  document.querySelector('.countdown')?.remove();
  const btn = document.querySelector<HTMLButtonElement>('#downloadbtn');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
  }
  showBypassNotice();
}

export function initUsersdriveAutomation(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    unlock();
    setTimeout(unlock, 0);
  });
}
