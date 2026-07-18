import { hostnameMatches } from '../../utils/domain-check';
import { LINKNEXT_HOSTS } from './hosts';

export const BLOG_STEPS = 3;
export const BLOG_STEP_MS = 10_000;

type LinksGoForm = { action: string; fields: Record<string, string> };
export type IncrementHit = {
  ok: boolean;
  completed: boolean;
  finalDestination: string | null;
  rateLimited: boolean;
};

const SSID_RE = /[a-f0-9]{32}/;
const readCookie = (name: string): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
};

const isExternalUrl = (href: string): boolean =>
  /^https?:\/\//i.test(href) && !/^javascript:/i.test(href);

export function mediatorSsid(href = location.href): string | null {
  try {
    const q = new URL(href).searchParams.get('ssid');
    return q && SSID_RE.test(q) ? q : null;
  } catch {
    return null;
  }
}

export function blogSsid(doc: Document = document): string | null {
  const html = doc.documentElement.innerHTML;
  return (
    /&quot;id&quot;:\[0,&quot;([a-f0-9]{32})&quot;\]/.exec(html)?.[1] ??
    /"id"\s*:\s*"([a-f0-9]{32})"/.exec(html)?.[1] ??
    null
  );
}

export function mediatorCsrfToken(): string | null {
  return readCookie('__csrf')?.trim() ?? null;
}

export function csrfFromMeta(doc: Document = document): string | null {
  return (
    doc.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content?.trim() ??
    readCookie('__csrf') ??
    null
  );
}

export async function fetchIpv4(): Promise<string> {
  const ip = (await (await fetch('https://ipv4.icanhazip.com/')).text()).trim();
  if (!ip) throw new Error('ipv4 empty');
  return ip;
}

export async function linknextAliasRedirectTarget(href = location.href): Promise<string> {
  const r = await fetch(href, { method: 'GET', redirect: 'manual', credentials: 'include' });
  const loc = r.headers.get('Location') ?? r.headers.get('location');
  if (!loc) throw new Error('alias location missing');
  return new URL(loc, href).href;
}

const mediatorHeaders = (): Record<string, string> => {
  const token = mediatorCsrfToken();
  if (!token) throw new Error('mediator csrf missing');
  return { 'Content-Type': 'application/json', 'X-CSRF-Token': token };
};

export async function mediatorPatchWithConflictClear(ssid: string, ip: string): Promise<string> {
  const payload = { ssid, currentIp: ip, ipType: 'IPv4', ipv4: ip, ipv6: null, hcaptchaToken: null };
  let r = await fetch(`/api/session/${ssid}`, {
    method: 'PATCH',
    headers: mediatorHeaders(),
    body: JSON.stringify(payload),
  });
  let raw = await r.text();
  if (r.status === 409) {
    const existingId = (JSON.parse(raw) as { existingSession?: { id?: string } }).existingSession?.id?.trim();
    if (!existingId || !SSID_RE.test(existingId)) throw new Error('conflict id missing');
    const del = await fetch(`/api/session/${existingId}`, { method: 'DELETE', headers: mediatorHeaders() });
    if (!del.ok) throw new Error(`delete ${del.status}`);
    r = await fetch(`/api/session/${ssid}`, {
      method: 'PATCH',
      headers: mediatorHeaders(),
      body: JSON.stringify(payload),
    });
    raw = await r.text();
  }
  if (!r.ok) throw new Error(`patch ${r.status}`);
  const redirect = (JSON.parse(raw) as { redirect?: string }).redirect?.trim() ?? '';
  if (!redirect.startsWith('http')) throw new Error('redirect missing');
  return redirect;
}

export async function patchSessionIncrement(ssid: string, token: string): Promise<IncrementHit> {
  const r = await fetch(`/api/session/${ssid}/step/increment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: '{}',
  });
  const raw = await r.text();
  let parsed: { success?: boolean; session?: { completed?: boolean; finalDestination?: string } } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {}
  return {
    ok: r.ok && !!parsed.success,
    completed: !!parsed.session?.completed,
    finalDestination: parsed.session?.finalDestination ?? null,
    rateLimited: /429/.test(raw),
  };
}

export function linksGoForm(doc: Document = document): LinksGoForm | null {
  const html = doc.documentElement.innerHTML;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const root of [doc, parsed]) {
    const form = root.querySelector<HTMLFormElement>('#go-link');
    if (!form?.querySelector('[name="ad_form_data"]')) continue;
    const action = new URL(form.getAttribute('action') || '/links/go', location.origin).href;
    const fields: Record<string, string> = {};
    form.querySelectorAll<HTMLInputElement>('input[name]').forEach((el) => {
      if (el.name) fields[el.name] = el.value ?? '';
    });
    return { action, fields };
  }
  return null;
}

export function counterSecFromPage(doc: Document = document): number {
  const m = doc.documentElement.innerHTML.match(/"counter_value"\s*:\s*"?(\d+)/);
  return m?.[1] ? Math.max(0, parseInt(m[1], 10)) : 0;
}

export async function postLinksGo(form: LinksGoForm, referer: string): Promise<string> {
  const r = await fetch(form.action, {
    method: 'POST',
    body: new URLSearchParams(form.fields),
    credentials: 'include',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    },
  });
  const url = ((JSON.parse(await r.text()) as { url?: string }).url ?? '').trim();
  if (!url || !isExternalUrl(url)) throw new Error('links/go url missing');
  try {
    if (hostnameMatches(new URL(url).hostname, LINKNEXT_HOSTS)) throw new Error('links/go url missing');
  } catch {
    throw new Error('links/go url missing');
  }
  return url;
}
