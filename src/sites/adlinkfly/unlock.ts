export type LinksGoForm = { action: string; fields: Record<string, string> };

const isHttpUrl = (href: string): boolean =>
  /^https?:\/\//i.test(href) && !/^javascript:/i.test(href);

export function linksGoFormFromHtml(html: string, base: string): LinksGoForm | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form =
    doc.querySelector<HTMLFormElement>('#go-link') ??
    doc.querySelector<HTMLFormElement>('form[action*="/links/go"]');
  if (!form) return null;
  let action = form.getAttribute('action') || '/links/go';
  if (!isHttpUrl(action)) action = new URL(action, base).href;
  const fields: Record<string, string> = {};
  form.querySelectorAll<HTMLInputElement>('input[name]').forEach((inp) => {
    if (inp.name) fields[inp.name] = inp.value ?? '';
  });
  return { action, fields };
}

export async function postLinksGo(form: LinksGoForm, referer: string): Promise<string | null> {
  try {
    const r = await fetch(form.action, {
      method: 'POST',
      body: new URLSearchParams(form.fields),
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
      },
    });
    const data = JSON.parse(await r.text()) as { url?: string };
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    return url && isHttpUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export function revealTimerLinks(root: ParentNode = document): void {
  for (const sel of ['#gt-link', '#link1s', 'a.get-link']) {
    const link = root.querySelector<HTMLAnchorElement>(sel);
    if (!link) continue;
    link.style.setProperty('display', 'inline-block', 'important');
    link.style.setProperty('visibility', 'visible', 'important');
    link.style.setProperty('opacity', '1', 'important');
    link.removeAttribute('hidden');
    link.classList.remove('hidden', 'disabled');
  }
  const unlockBtn = root.querySelector<HTMLElement>('#btn-unlock, #btn-wait');
  if (unlockBtn && !unlockBtn.dataset['swClicked']) {
    unlockBtn.dataset['swClicked'] = '1';
    unlockBtn.click();
  }
}
