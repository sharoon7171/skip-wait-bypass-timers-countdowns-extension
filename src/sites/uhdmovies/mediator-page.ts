import { isAllowedHost } from '../../utils/domain-check';

const MEDIATOR_PAGE_HOSTS = [
  'cloud.unblockedgames.world',
  'tech.examzculture.in',
] as const;

const deflateBase64 = (value: string): Promise<string> =>
  new Response(new Blob([value]).stream().pipeThrough(new CompressionStream('deflate')))
    .arrayBuffer()
    .then((buf) => btoa(String.fromCharCode(...new Uint8Array(buf))));

export function initUhdmoviesMediatorPage(): void {
  if (!isAllowedHost(MEDIATOR_PAGE_HOSTS)) return;
  const sid = new URLSearchParams(location.search).get('sid');
  if (!sid) return;

  void deflateBase64(sid).then((payload) => {
    const slug = `pepe-${crypto.getRandomValues(new Uint8Array(6)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')}`;
    document.cookie = `${slug}=${payload};path=/;max-age=3600;samesite=lax`;
    location.replace(`${location.origin}/?go=${slug}`);
  });
}
