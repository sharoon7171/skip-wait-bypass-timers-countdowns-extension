const BASE_REDIRECT_URL = 'https://multiup.io/en/mirror/';
const MIRROR_PATH = '/en/mirror/';
const MULTIUP_DIRECT_RE = /multiup\.io\/([a-zA-Z0-9]+)/;
const MULTIUP_PHP_RE = /\/multiup\.php\?id=([a-zA-Z0-9]+)/;

export function initMultiup(): void {
  const url = window.location.href;
  if (!url.includes('multiup') || url.includes(MIRROR_PATH)) return;
  const id = url.match(MULTIUP_PHP_RE)?.[1] ?? url.match(MULTIUP_DIRECT_RE)?.[1] ?? null;
  if (id) window.location.href = `${BASE_REDIRECT_URL}${id}`;
}
