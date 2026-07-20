import { MOVE2LINK_API } from './hosts';

const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type JwtProgress = { step: number; maxStep: number };
type ApiData = { token?: string; redirect_url?: string };

const readCookie = (name: string): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

const asJwt = (raw: string | null | undefined): string | null => {
  const t = raw?.trim() ?? '';
  return JWT_RE.test(t) ? t : null;
};

export function sessionToken(href = location.href): string | null {
  try {
    const fromQuery = asJwt(new URL(href).searchParams.get('token'));
    if (fromQuery) return fromQuery;
  } catch {}
  return asJwt(readCookie('SESSION'));
}

export function jwtProgress(token: string): JwtProgress | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4));
    const p = JSON.parse(json) as { step?: string | number; max_step?: string | number };
    const step = Number(p.step);
    const maxStep = Number(p.max_step);
    if (!Number.isFinite(step) || !Number.isFinite(maxStep) || maxStep < 1) return null;
    return { step, maxStep };
  } catch {
    return null;
  }
}

const api = async (path: '/views/track' | '/views/finalize', method: 'PUT' | 'POST', token: string): Promise<ApiData> => {
  const r = await fetch(`${MOVE2LINK_API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, csrf_token: 'x', imps: [] }),
  });
  const raw = await r.text();
  let parsed: { data?: ApiData } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {}
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return parsed.data ?? {};
};

export async function unlockDestination(token: string): Promise<string> {
  let cur = token;
  for (;;) {
    const progress = jwtProgress(cur);
    if (!progress) throw new Error('jwt');
    if (progress.step >= progress.maxStep - 1) break;
    const next = (await api('/views/track', 'PUT', cur)).token?.trim();
    if (!next || !JWT_RE.test(next)) throw new Error('track');
    cur = next;
  }
  const url = (await api('/views/finalize', 'POST', cur)).redirect_url?.trim() ?? '';
  if (!/^https?:\/\//i.test(url)) throw new Error('finalize');
  return url;
}

export function decodeGoToParam(raw: string): string | null {
  try {
    const bin = atob(raw.trim());
    let pct = '';
    for (let i = 0; i < bin.length; i++) pct += `%${bin.charCodeAt(i)!.toString(16).padStart(2, '0')}`;
    const url = decodeURIComponent(pct).trim();
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}
