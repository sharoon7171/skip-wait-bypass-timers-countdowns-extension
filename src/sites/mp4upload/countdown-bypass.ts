import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['mp4upload.com'] as const;
const BRAND_ID = 'skipwait-mp4upload-brand';

function isTimerPage(): boolean {
  const form = document.querySelector<HTMLInputElement>('input[name="op"][value="download1"]')?.form;
  const free = form?.querySelector<HTMLInputElement>('#method_free, input[name="method_free"]');
  return !!(form && free && document.getElementById('countdown'));
}

function isCreateLinkPage(): boolean {
  const form = document.querySelector<HTMLInputElement>('input[name="op"][value="download2"]')?.form;
  return !!(form && document.getElementById('downloadbtn') && document.querySelector('.dl1-rail'));
}

function download1Form(): HTMLFormElement | null {
  return (
    document.querySelector<HTMLInputElement>('input[name="op"][value="download1"]')?.form ?? null
  );
}

function mountPage2Brand(): void {
  if (document.getElementById(BRAND_ID)) return;
  const btn = document.getElementById('downloadbtn');
  if (!btn?.parentElement) return;

  const card = document.createElement('div');
  card.id = BRAND_ID;
  card.className = 'info-card';
  card.setAttribute('role', 'status');

  const label = document.createElement('div');
  label.className = 'info-label';
  label.textContent = 'Skip Wait';

  const list = document.createElement('ul');
  const row = document.createElement('li');
  const name = document.createElement('span');
  name.className = 'infoname';
  name.textContent = 'Status';
  const value = document.createElement('span');
  value.textContent = 'Timer skipped — use Download Now';
  row.append(name, value);
  list.append(row);
  card.append(label, list);
  btn.before(card);
}

function runTimerPage(): void {
  document.getElementById('countdown')?.remove();
  const form = download1Form();
  const free = form?.querySelector<HTMLInputElement>('#method_free, input[name="method_free"]');
  if (!form || !free) return;
  free.disabled = false;
  free.removeAttribute('disabled');
  free.click();
}

function run(): void {
  if (isTimerPage()) {
    runTimerPage();
    return;
  }
  if (isCreateLinkPage()) mountPage2Brand();
}

export function initMp4uploadCountdownBypass(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(run);
}
