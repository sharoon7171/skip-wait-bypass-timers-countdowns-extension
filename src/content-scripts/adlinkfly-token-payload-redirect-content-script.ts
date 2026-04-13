import { isAllowedHost, whenDomParsed } from '../utils/domain-check';

const ADLINKFLY_TOKEN_PAYLOAD_HOSTS = ['oii.la', 'tpi.li'] as const;
const ADLINKFLY_TOKEN_PAYLOAD_DESTINATION_DELIM = '1304';

function padBase64(s: string): string {
  const p = s.length % 4;
  return p ? s + '='.repeat(4 - p) : s;
}

function destinationUrlFromAdlinkflyTokenPayload(token: string): string | null {
  const idx = token.indexOf(ADLINKFLY_TOKEN_PAYLOAD_DESTINATION_DELIM);
  if (idx === -1) return null;
  const raw = token.slice(idx + ADLINKFLY_TOKEN_PAYLOAD_DESTINATION_DELIM.length).trim();
  if (!raw) return null;
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const bin = atob(padBase64(normalized));
    const out = new TextDecoder('utf-8').decode(
      Uint8Array.from(bin, (c) => c.charCodeAt(0)),
    );
    const t = out.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
  } catch {
    return null;
  }
  return null;
}

function runAdlinkflyTokenPayloadRedirect(): void {
  const input = document.querySelector<HTMLInputElement>('input[name="token"]');
  const token = input?.value?.trim();
  if (!token) return;
  const url = destinationUrlFromAdlinkflyTokenPayload(token);
  if (url) window.location.replace(url);
}

export function initAdlinkflyTokenPayloadRedirect(): void {
  if (!isAllowedHost(ADLINKFLY_TOKEN_PAYLOAD_HOSTS)) return;
  whenDomParsed(runAdlinkflyTokenPayloadRedirect);
}
