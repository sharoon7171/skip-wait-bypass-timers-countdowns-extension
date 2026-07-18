export type ExeioFormFields = Record<string, string>;

const isHttpUrl = (href: string): boolean => /^https?:\/\//i.test(href);

const isInternalHost = (href: string): boolean => {
  try {
    const h = new URL(href).hostname.toLowerCase();
    return h === 'exe.io' || h === 'exeygo.com' || h.endsWith('.exe.io') || h.endsWith('.exeygo.com');
  } catch {
    return false;
  }
};

export function readFormFields(form: HTMLFormElement): ExeioFormFields {
  const fields: ExeioFormFields = {};
  for (const el of form.elements) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLButtonElement))
      continue;
    if (!el.name || el.disabled) continue;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && !el.checked) continue;
    fields[el.name] = el.value ?? '';
  }
  return fields;
}

export function formBody(fields: ExeioFormFields): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) params.append(k, v);
  return params.toString();
}

export function counterSecFromPage(): number {
  const av = (window as unknown as { app_vars?: { counter_value?: string } }).app_vars;
  const fromVars = parseInt(String(av?.counter_value ?? ''), 10);
  if (Number.isFinite(fromVars) && fromVars >= 0) return fromVars;
  const m = document.documentElement.innerHTML.match(/"counter_value"\s*:\s*"?(\d+)/);
  if (m?.[1]) return Math.max(0, parseInt(m[1], 10));
  return 6;
}

function urlFromJsonText(text: string): string | null {
  try {
    const data = JSON.parse(text) as { url?: unknown; status?: unknown };
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    if (url && isHttpUrl(url) && !isInternalHost(url)) return url;
  } catch {}
  const m = text.match(/https?:\/\/[^"'\\\s<>]+/);
  if (m?.[0] && isHttpUrl(m[0]) && !isInternalHost(m[0])) return m[0];
  return null;
}

export async function postLinksGoForUrl(
  fields: ExeioFormFields,
  referer: string,
): Promise<string | null> {
  const action = new URL('/links/go', location.origin).href;
  const body = formBody(fields);

  const tryFetch = async (
    headers: Record<string, string>,
  ): Promise<string | null> => {
    const r = await fetch(action, {
      method: 'POST',
      body,
      credentials: 'include',
      headers,
      redirect: 'follow',
    });
    if (r.url && isHttpUrl(r.url) && !isInternalHost(r.url)) return r.url;
    const text = await r.text();
    return urlFromJsonText(text);
  };

  try {
    return await tryFetch({
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
    });
  } catch {
    return null;
  }
}

export function submitGoLinkNative(form: HTMLFormElement): void {
  form.setAttribute('action', new URL('/links/go', location.origin).href);
  form.setAttribute('method', 'post');
  HTMLFormElement.prototype.submit.call(form);
}
