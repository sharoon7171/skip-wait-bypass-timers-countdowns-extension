const DELTA_HREF_RE = /href=["'](https?:\/\/[^"']*deltastudy\.site[^"']*)["']/gi;
const PLEASE_WAIT_MAX = 2800;

export function pageHtml(): string {
  return document.documentElement?.innerHTML ?? '';
}

export function isArolinksPleaseWait(html: string = pageHtml()): boolean {
  if (html.length > PLEASE_WAIT_MAX) return false;
  const text =
    html === pageHtml() && document.body?.innerText
      ? document.body.innerText
      : html;
  return /please\s*wait/i.test(text);
}

export async function fetchArolinksAliasPage(
  alias: string,
  referer: string,
): Promise<string> {
  const url = `https://arolinks.com/${alias}`;
  const r = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    redirect: 'follow',
    headers: { Accept: 'text/html', Referer: referer },
  });
  return r.text();
}

export function isArolinksTimerShell(html: string = pageHtml()): boolean {
  if (isArolinksPleaseWait(html)) return false;
  if (html.length < 5000) return false;
  return (
    /#link1s|#link-view|btn-unlock|counter_value|\/links\/go|id=["']go-link["']|a\.get-link/i.test(
      html,
    ) || html.includes('deltastudy.site')
  );
}

export function renderArolinksTimerPage(html: string): void {
  document.open();
  document.write(html);
  document.close();
}

export function deltaUrlFromHtml(html: string): string | null {
  for (const re of [DELTA_HREF_RE, /(https?:\/\/[^\s"'<>]*deltastudy\.site[^\s"'<>]*)/gi]) {
    re.lastIndex = 0;
    const m = re.exec(html);
    const url = m?.[1] ?? m?.[0];
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

export function deltaUrlFromDom(root: ParentNode = document): string | null {
  const link1s = root.querySelector<HTMLAnchorElement>('#link1s');
  if (link1s) {
    const href = link1s.getAttribute('href') ?? link1s.href;
    if (href && href.includes('deltastudy.site')) return href;
  }
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href*="deltastudy.site"]')) {
    const href = a.getAttribute('href') ?? a.href;
    if (href && /^https?:\/\//i.test(href)) return href;
  }
  const html =
    root instanceof Document
      ? root.documentElement?.innerHTML
      : (root as Element).innerHTML;
  return html ? deltaUrlFromHtml(html) : null;
}

export function revealTimerLinks(root: ParentNode = document): void {
  const link1s = root.querySelector<HTMLAnchorElement>('#link1s');
  if (link1s) {
    link1s.style.setProperty('display', 'inline-block', 'important');
    link1s.style.setProperty('visibility', 'visible', 'important');
    link1s.style.setProperty('opacity', '1', 'important');
    link1s.removeAttribute('hidden');
    link1s.classList.remove('hidden');
  }
  const unlockBtn = root.querySelector<HTMLElement>('#btn-unlock, #btn-wait');
  if (unlockBtn && !unlockBtn.dataset['swClicked']) {
    unlockBtn.dataset['swClicked'] = '1';
    unlockBtn.click();
  }
}

export type LinksGoForm = { action: string; fields: Record<string, string> };

export function linksGoFormFromHtml(html: string, base: string): LinksGoForm | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const form =
    doc.querySelector<HTMLFormElement>('#go-link') ??
    doc.querySelector<HTMLFormElement>('form[action*="/links/go"]');
  if (!form) return null;
  let action = form.getAttribute('action') || '/links/go';
  if (!/^https?:\/\//i.test(action)) action = new URL(action, base).href;
  const fields: Record<string, string> = {};
  form.querySelectorAll<HTMLInputElement>('input[name]').forEach((inp) => {
    if (inp.name) fields[inp.name] = inp.value ?? '';
  });
  return { action, fields };
}

export async function postLinksGo(
  form: LinksGoForm,
  referer: string,
): Promise<string | null> {
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
    return url && /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

export function jsRedirectTarget(html: string, base: string): string | null {
  for (const re of [
    /(?:document|window)\.location\.href\s*=\s*["']([^"']+)["']/,
    /window\.location\.href\s*=\s*["']([^"']+)["']/,
  ]) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        return new URL(m[1], base).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function mediatorPleaseWaitUrl(html: string = pageHtml()): string | null {
  const target = jsRedirectTarget(html, location.href);
  if (target && !target.includes('arolinks.com')) return target;
  return null;
}
