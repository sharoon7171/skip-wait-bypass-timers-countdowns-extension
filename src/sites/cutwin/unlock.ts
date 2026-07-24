type GetLinkResponse = {
  status?: string;
  url?: string;
  message?: string;
};

const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

export function cutwinFlowFromPage(doc: Document = document): { csrf: string; flow: string } | null {
  const csrf = doc.querySelector<HTMLInputElement>('#_csrfToken')?.value?.trim() ?? '';
  const flow =
    doc.querySelector<HTMLInputElement>('input[name="flow"]')?.value?.trim() ??
    new URL(location.href).searchParams.get('flow')?.trim() ??
    '';
  if (!csrf || !flow) return null;
  if (!doc.querySelector('#lview')) return null;
  return { csrf, flow };
}

export function isCutwinBlogPage(doc: Document = document): boolean {
  try {
    if (!new URL(location.href).searchParams.get('flow')) return false;
  } catch {
    return false;
  }
  return cutwinFlowFromPage(doc) !== null;
}

export async function postCutwinGetLink(
  pageUrl: string,
  csrf: string,
  flow: string,
): Promise<string> {
  const body = new URLSearchParams({
    _method: 'POST',
    ajax: 'get_link',
    _csrfToken: csrf,
    flow,
  });
  const r = await fetch(pageUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  });
  const raw = (await r.text()).replace(/^\uFEFF/, '').trim();
  let data: GetLinkResponse;
  try {
    data = JSON.parse(raw) as GetLinkResponse;
  } catch {
    throw new Error('get_link bad json');
  }
  const url = data.url?.trim() ?? '';
  if (data.status !== 'success' || !isHttpUrl(url)) {
    throw new Error(data.message?.trim() || 'get_link');
  }
  return url;
}
