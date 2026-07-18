import { createFullPageOverlay } from '../../injected-ui/full-page-overlay';
import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { KOTAKANIMEID_HOSTS } from './hosts';

const OVERLAY_ID = 'skip-wait-kotakanimeid-out';
const BRAND_ID = 'skipwait-kotakanimeid-brand';
const OUT_PATH_RE = /^\/out\//i;
const FINGERPRINT = 'dummy-fingerprint';
const RES_ORDER = ['1080p', 'HD', '720p', '480p', '360p'] as const;

type TokenRes = {
  success?: boolean;
  token?: string;
  timestamp?: number;
  challenge?: string;
  message?: string;
};

type LinkItem = { url?: string; text?: string };

type DownloadRes = {
  status?: string;
  message?: string;
  links?: Record<string, LinkItem[] | undefined>;
};

type DlConfig = {
  encrypted: string;
  title: string;
  isBlogger: boolean;
};

type FlatLink = {
  url: string;
  text: string;
  group: string;
};

const INFO_BOX =
  'rounded-xl border p-4 text-sm border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300';
const WARN_BOX =
  'rounded-xl border p-4 text-sm border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300';
const ERR_BOX =
  'rounded-xl border p-4 text-sm border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300';

function dlConfigFromDom(): DlConfig | null {
  for (const script of document.querySelectorAll('script:not([src])')) {
    const text = script.textContent ?? '';
    if (!/window\.DL\s*=/.test(text)) continue;
    const encrypted = text.match(/encrypted\s*:\s*["']([^"']+)["']/)?.[1] ?? '';
    if (!encrypted) return null;
    return {
      encrypted,
      title: text.match(/title\s*:\s*["']([^"']*)["']/)?.[1] ?? '',
      isBlogger: /isBlogger\s*:\s*true/.test(text),
    };
  }
  return null;
}

function isOutDownloadGate(): boolean {
  if (!OUT_PATH_RE.test(location.pathname)) return false;
  if (!dlConfigFromDom()) return false;
  return !!(
    document.getElementById('download-section') &&
    document.getElementById('result-section') &&
    (document.getElementById('generate-btn') || document.getElementById('countdown')) &&
    document.querySelector('script[src*="/video/download/download.js"]')
  );
}

function showLoading(on: boolean): void {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList.toggle('hidden', !on);
  loading.classList.toggle('flex', on);
}

function hideWaitUi(): void {
  document.getElementById('countdown')?.classList.add('hidden');
  const btn = document.getElementById('generate-btn');
  if (btn) {
    btn.classList.add('hidden');
    btn.classList.remove('inline-flex');
  }
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Fingerprint': FINGERPRINT,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function withToken(urlForToken: string, downloadUrl: string, bodyUrl: string): Promise<DownloadRes> {
  const token = await postJson<TokenRes>('/video/get-token.php', { url: urlForToken });
  if (!token.success || !token.token || !token.challenge || token.timestamp == null) {
    throw new Error(token.message || 'Token request failed');
  }
  return postJson<DownloadRes>(
    downloadUrl,
    { url: bodyUrl, challenge: token.challenge },
    {
      'X-Security-Token': token.token,
      'X-Timestamp': String(token.timestamp),
      'X-Challenge': token.challenge,
    },
  );
}

function absUrl(path: string): string {
  return path.startsWith('http') ? path : new URL(path, location.origin).href;
}

async function fetchDownloadLinks(cfg: DlConfig): Promise<DownloadRes> {
  if (cfg.isBlogger) {
    const requestUrl = new URL('/video/get-download.php', location.origin);
    requestUrl.searchParams.set('mode', 'lokal');
    requestUrl.searchParams.set('vid', encodeURIComponent(cfg.encrypted));
    if (cfg.title) requestUrl.searchParams.set('title', encodeURIComponent(cfg.title));
    requestUrl.searchParams.set('dl', 'yes');
    requestUrl.searchParams.set('json', 'true');
    const href = requestUrl.toString();
    return withToken(href, href, href);
  }
  return withToken(cfg.encrypted, '/video/get-download.php', cfg.encrypted);
}

function flattenLinks(links: DownloadRes['links']): FlatLink[] {
  if (!links) return [];
  const out: FlatLink[] = [];
  const seen = new Set<string>();

  const pushGroup = (group: string, items: LinkItem[] | undefined): void => {
    for (const item of items ?? []) {
      const raw = item.url?.trim();
      if (!raw) continue;
      const url = absUrl(raw);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, text: item.text?.trim() || group, group });
    }
  };

  for (const res of RES_ORDER) pushGroup(res, links[res]);
  pushGroup('download', links['download']);
  for (const [key, items] of Object.entries(links)) {
    if (key === 'download' || (RES_ORDER as readonly string[]).includes(key)) continue;
    pushGroup(key, items);
  }
  return out;
}

function groupLinks(flat: FlatLink[]): Map<string, FlatLink[]> {
  const map = new Map<string, FlatLink[]>();
  for (const link of flat) {
    const list = map.get(link.group) ?? [];
    list.push(link);
    map.set(link.group, list);
  }
  return map;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function mountBrandNotice(parent: HTMLElement): void {
  if (document.getElementById(BRAND_ID)) return;
  const box = el('div', INFO_BOX);
  box.id = BRAND_ID;
  box.setAttribute('role', 'status');
  const strong = el('strong', undefined, 'Skip Wait');
  const detail = el(
    'span',
    undefined,
    ' Wait skipped. Choose a resolution below — each link opens that file.',
  );
  box.append(strong, detail);
  parent.prepend(box);
  parent.append(el('div', 'h-4'));
}

function renderMultiResult(flat: FlatLink[]): void {
  const result = document.getElementById('result-section');
  if (!result) return;
  result.replaceChildren();
  result.classList.remove('hidden');
  result.classList.add('w-full', 'text-left');

  mountBrandNotice(result);
  result.append(el('h3', 'mb-4 text-center text-base font-semibold', 'Unduhan Siap'));

  const grouped = groupLinks(flat);
  const hasParts = [...grouped.values()].some((items) => items.length > 1);
  if (hasParts) {
    const warn = el('div', WARN_BOX);
    const strong = el('strong', undefined, 'File Terbagi.');
    warn.append(strong, document.createTextNode(' Pastikan mengunduh semua bagian (part).'));
    result.append(warn, el('div', 'h-4'));
  }

  const grid = el('div', 'mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2');
  const order = [
    ...RES_ORDER.filter((k) => grouped.has(k)),
    ...[...grouped.keys()].filter((k) => !(RES_ORDER as readonly string[]).includes(k)),
  ];

  for (const group of order) {
    const items = grouped.get(group);
    if (!items?.length) continue;
    const card = el(
      'div',
      'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50',
    );
    const head = el(
      'div',
      'mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-700',
    );
    const icon = el('i', 'fa-solid fa-film text-violet-500');
    head.append(icon, el('h4', 'text-sm font-semibold', group === 'download' ? 'Download' : group));
    const actions = el('div', 'flex flex-wrap gap-2');
    for (const item of items) {
      const a = el(
        'a',
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-500 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-violet-400',
      );
      a.href = item.url;
      a.rel = 'noopener nofollow';
      a.append(el('i', 'fa-solid fa-download text-xs'), document.createTextNode(' ' + item.text));
      actions.append(a);
    }
    card.append(head, actions);
    grid.append(card);
  }
  result.append(grid);

  const info = el('div', INFO_BOX);
  const title = el('strong', undefined, 'Info Server Lokal.');
  const list = el('ul', 'mt-1 list-disc space-y-0.5 pl-4 text-xs opacity-90');
  list.append(
    el('li', undefined, 'Kualitas video mungkin lebih rendah untuk adegan aksi cepat.'),
    el('li', undefined, 'Ukuran file bisa lebih besar karena diproses ulang server.'),
  );
  const wrap = el('div');
  wrap.append(title, list);
  info.append(wrap);
  result.append(info);

  document.getElementById('generate-btn')?.remove();
}

function renderError(message: string): void {
  const result = document.getElementById('result-section');
  if (!result) return;
  result.replaceChildren();
  result.classList.remove('hidden');
  const box = el('div', ERR_BOX, message);
  result.append(box);
}

function unlockSingle(url: string): void {
  createFullPageOverlay({
    id: OVERLAY_ID,
    brand: 'Skip Wait',
    note: {
      lead: 'Skipping KotakAnimeID wait…',
      detail: 'No countdown. Opening the real download destination.',
    },
    status: 'Opening destination…',
  });
  location.replace(url);
}

async function run(): Promise<void> {
  const cfg = dlConfigFromDom();
  if (!cfg) return;

  hideWaitUi();
  showLoading(true);

  try {
    const data = await fetchDownloadLinks(cfg);
    if (data.status !== 'success') throw new Error(data.message || 'Download link failed');

    const flat = flattenLinks(data.links);
    if (flat.length === 0) throw new Error(data.message || 'No download links returned');

    const only = flat.length === 1 ? flat[0] : null;
    if (only) {
      unlockSingle(only.url);
      return;
    }

    renderMultiResult(flat);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    renderError('Terjadi kesalahan: ' + message);
  } finally {
    showLoading(false);
    document.getElementById('result-section')?.classList.remove('hidden');
  }
}

export function initKotakanimeidOutPage(): void {
  if (!isAllowedHost(KOTAKANIMEID_HOSTS)) return;
  whenDomParsed(() => {
    if (!isOutDownloadGate()) return;
    void run();
  });
}
