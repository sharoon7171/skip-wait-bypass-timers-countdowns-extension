import { isAllowedHost } from '../../utils/domain-check';

const FILEPRESS_HOSTS = ['filepress.baby'] as const;
const FILEPRESS_API = '/api/file';
const FILEPRESS_FILE_RE = /^\/file\/([^/]+)\/?$/i;
const DOTFLIX_CODE_RE = /btoa\('([A-F0-9]+)'\)/;
const DOTFLIX_EXTRACT = 'https://dotflix.lol/api/extract-download';
const FILEPRESS_LABEL_METHOD = {
  'Instant Download': 'dotFlixDownlaod',
  'Direct Download': 'indexDownlaod',
} as const;

const filePressPost = (path: string, body: object) =>
  fetch(`${FILEPRESS_API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captchaValue: '', ...body }),
  }).then((r) => r.json() as Promise<{ status?: boolean; data?: unknown }>).then((j) => (j.status ? j.data : null));

const resolveFilePressIndex = async (fileId: string): Promise<string | null> => {
  const token = await filePressPost('/downlaod/', { id: fileId, method: 'indexDownlaod' });
  if (typeof token !== 'string') return null;
  const data = await filePressPost('/downlaod2/', { id: token, method: 'indexDownlaod' });
  const url = (data as string[])?.[0];
  return typeof url === 'string' ? url : null;
};

const resolveFilePressDotFlix = async (fileId: string): Promise<string | null> => {
  const share = await filePressPost('/downlaod/', { id: fileId, method: 'dotFlixDownlaod' });
  if (typeof share !== 'string') return null;
  const code = (await fetch(share).then((r) => r.text())).match(DOTFLIX_CODE_RE)?.[1];
  if (!code) return null;
  const requestId = crypto.randomUUID();
  const timestamp = Date.now();
  const j = await fetch(DOTFLIX_EXTRACT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Timestamp': String(timestamp),
    },
    body: JSON.stringify({ requestId, timestamp, data: btoa(code).split('').reverse().join('') }),
  }).then((r) => r.json() as Promise<{ success?: boolean; downloadUrl?: string }>);
  return j.success && typeof j.downloadUrl === 'string' ? j.downloadUrl : null;
};

const prefetchFilePressUrls = (fileId: string, options: Record<string, boolean>) => {
  const ready = new Map<string, Promise<string | null>>();
  if (options['indexDownlaod']) ready.set('Direct Download', resolveFilePressIndex(fileId));
  if (options['dotFlixDownlaod']) ready.set('Instant Download', resolveFilePressDotFlix(fileId));
  return ready;
};

export function initFilePressDirectDownload(): void {
  if (!isAllowedHost(FILEPRESS_HOSTS)) return;
  const fileId = location.pathname.match(FILEPRESS_FILE_RE)?.[1];
  if (!fileId) return;

  let ready = new Map<string, Promise<string | null>>();
  void fetch(`${FILEPRESS_API}/get/${fileId}`, { credentials: 'include' })
    .then((r) => r.json())
    .then((j) => j.data?.downloadOptions as Record<string, boolean> | undefined)
    .then((options) => {
      if (options) ready = prefetchFilePressUrls(fileId, options);
    });

  document.addEventListener(
    'click',
    (e) => {
      const label = (e.target as Element).closest('button')?.textContent?.replace(/\s+/g, ' ').trim();
      if (!label || !(label in FILEPRESS_LABEL_METHOD)) return;
      const pending = ready.get(label);
      if (!pending) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void pending.then((url) => {
        if (url) location.replace(url);
      });
    },
    true,
  );
}
