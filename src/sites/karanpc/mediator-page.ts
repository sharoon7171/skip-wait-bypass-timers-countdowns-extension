import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['inloadapi.com'] as const;
const DATA_RE = /var\s+data\s*=\s*(\{[\s\S]*?\});/;

type Data = { canPost?: boolean; actionUrl?: string; basename?: string; post_title?: string; post_link?: string };

function parseData(): Data | null {
  const tryParse = (raw: string | undefined): Data | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Data;
    } catch {
      return null;
    }
  };
  for (const s of document.scripts) {
    const d = tryParse(DATA_RE.exec(s.textContent ?? '')?.[1]);
    if (d) return d;
  }
  return tryParse(DATA_RE.exec(document.documentElement.innerHTML)?.[1]);
}

function submitRoute(d: Data): void {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = d.actionUrl ?? `${location.origin}/`;
  f.target = '_self';
  const add = (n: string, v: string): void => {
    f.appendChild(Object.assign(document.createElement('input'), { type: 'hidden', name: n, value: v }));
  };
  add('system_route', 'ii');
  add('basename', d.basename ?? '');
  if (d.post_title) add('post_title', d.post_title);
  if (d.post_link) add('post_link', d.post_link);
  document.body.append(f);
  f.submit();
}

function showNotice(): void {
  const wait = document.querySelector<HTMLElement>('.wait-text');
  if (!wait || wait.dataset['swBypass']) return;
  wait.dataset['swBypass'] = '1';
  wait.textContent = 'Skip Wait skipped the wait timer. Click Go to Link to continue.';
  wait.style.color = '#2ecc71';
}

let unlocked = false;

function unlock(): void {
  if (unlocked) return;
  const btn = document.getElementById('continueBtn');
  if (!(btn instanceof HTMLButtonElement) || /expired/i.test(btn.textContent ?? '')) return;
  const data = parseData();
  if (!data?.canPost || !data.basename) return;

  unlocked = true;
  showNotice();
  document.querySelector('.progress-track')?.remove();

  btn.textContent = 'Go to Link';
  btn.classList.add('active');
  btn.classList.remove('clicked');
  const fresh = btn.cloneNode(true) as HTMLButtonElement;
  btn.replaceWith(fresh);
  fresh.addEventListener('click', (e) => {
    e.preventDefault();
    if (fresh.classList.contains('clicked')) return;
    fresh.textContent = 'Opening...';
    fresh.classList.remove('active');
    fresh.classList.add('clicked');
    submitRoute(data);
  });
}

export function initKaranpcMediatorPage(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    unlock();
    setTimeout(unlock, 0);
    setTimeout(unlock, 50);
  });
}
