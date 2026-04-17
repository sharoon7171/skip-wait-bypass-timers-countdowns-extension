import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['cloud.unblockedgames.world'];

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

function randomSlug(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `pepe-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

async function zlibDeflateBase64(input: string): Promise<string> {
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate'));
  return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}

async function shortcut(sid: string): Promise<void> {
  const slug = randomSlug();
  document.cookie = `${slug}=${await zlibDeflateBase64(sid)};path=/;max-age=3600;samesite=lax`;
  window.location.replace(`${window.location.origin}/?go=${slug}`);
}

export function initUhdmoviesCloudContentScript(): void {
  if (!isAllowedHost(HOSTS)) return;
  const sid = new URLSearchParams(window.location.search).get('sid');
  if (!sid) return;
  void shortcut(sid);
}
