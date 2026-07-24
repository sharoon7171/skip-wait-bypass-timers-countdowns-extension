const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const readCookie = (name: string): string => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m?.[1] ? decodeURIComponent(m[1]) : '';
};

const jsonPost = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const r = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`${path} bad json`);
  }
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return data;
};

export const sessionToken = (): string => {
  const xsrf = readCookie('XSRF-TOKEN');
  if (!xsrf) throw new Error('xsrf');
  const fp = 'a'.repeat(64);
  const suffix = `#${btoa(fp)}`;
  const keep = Math.max(0, 128 - suffix.length);
  return xsrf.slice(0, keep) + suffix;
};

type SessionData = {
  step?: number;
  captcha?: string | null;
  passcode?: boolean;
};

type VerifyData = { target?: string; message?: string };
type GoData = { url?: string; message?: string };

export const postSession = (): Promise<SessionData> =>
  jsonPost<SessionData>('/api/session', { _token: sessionToken() });

export const postVerify = async (): Promise<string> => {
  const data = await jsonPost<VerifyData>('/api/verify', {
    _a: 0,
    captcha: '',
    passcode: '',
  });
  const target = data.target?.trim() ?? '';
  if (!isHttpUrl(target)) throw new Error('verify target');
  return target;
};

export const postGo = async (): Promise<string> => {
  const key = Math.floor(Math.random() * 1000);
  const w = window.innerWidth || 1440;
  const h = window.innerHeight || 900;
  const size = `${(w + key) * 2}.${(h + key) * 2}`;
  const data = await jsonPost<GoData>('/api/go', { key, size });
  const url = data.url?.trim() ?? '';
  if (!isHttpUrl(url)) throw new Error('go url');
  return url;
};

const warmPage = async (url: string): Promise<void> => {
  await fetch(url, { method: 'GET', credentials: 'include', redirect: 'follow' });
};

export const destFromReadyHtml = (html: string): string | null => {
  const patterns = [
    /window\.location\.href\s*=\s*"((?:\\.|[^"\\])+)"/i,
    /window\.location\.href\s*=\s*'((?:\\.|[^'\\])+)'/i,
    /location\.replace\(\s*"((?:\\.|[^"\\])+)"\s*\)/i,
    /location\.replace\(\s*'((?:\\.|[^'\\])+)'\s*\)/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (!m?.[1]) continue;
    const url = m[1].replace(/\\\//g, '/').replace(/\\u002f/gi, '/').trim();
    if (isHttpUrl(url)) return url;
  }
  return null;
};

export const fetchReadyDestination = async (readyUrl: string): Promise<string> => {
  const r = await fetch(readyUrl, { method: 'GET', credentials: 'include' });
  const html = await r.text();
  const dest = destFromReadyHtml(html);
  if (!dest) throw new Error('ready dest');
  return dest;
};

export async function unlockFromBlog(): Promise<string> {
  let session = await postSession();
  for (let i = 0; i < 6; i++) {
    const step = Number(session.step);
    if (!Number.isFinite(step)) throw new Error('session step');
    if (step !== 1) {
      const ready = await postGo();
      try {
        return await fetchReadyDestination(ready);
      } catch {
        return ready;
      }
    }
    if (session.captcha != null && session.captcha !== '') throw new Error('captcha required');
    const target = await postVerify();
    await warmPage(target);
    session = await postSession();
  }
  throw new Error('step loop');
}

export function landingRedirectUrl(doc: Document = document): string | null {
  const form = doc.querySelector<HTMLFormElement>('form#form');
  if (!form) return null;
  const action = form.getAttribute('action')?.trim() ?? '';
  if (!isHttpUrl(action)) return null;
  const params = new URLSearchParams();
  form.querySelectorAll<HTMLInputElement>('input[name]').forEach((inp) => {
    if (inp.name) params.append(inp.name, inp.value ?? '');
  });
  if (!params.get('alias') || !params.get('ray_id')) return null;
  const url = new URL(action);
  params.forEach((v, k) => url.searchParams.set(k, v));
  return url.href;
}

export function destFromReadyPage(doc: Document = document): string | null {
  return destFromReadyHtml(doc.documentElement.innerHTML);
}
