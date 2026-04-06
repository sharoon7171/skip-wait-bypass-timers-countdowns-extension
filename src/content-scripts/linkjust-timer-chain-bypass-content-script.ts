import { isAllowedHost, whenDomParsed } from '../utils/domain-check';
import { attachAdlinkflyLinksGo } from './adlinkfly-links-go-content-script';

const AD_SHELL_SEL = '#link-view,#go-link,form[action*="/links/go"],a.get-link';
const LINKJUST = ['linkjust.com'] as const;
const OBS_HOP: MutationObserverInit = {
  attributeFilter: ['href', 'style', 'class'],
  attributes: true,
  childList: true,
  subtree: true,
};
const CHAIN_HTML_MARKERS = [
  'Loading Link',
  'linkjust-timer',
  'linkjustInit',
  'next-timer-btn',
  'timer_seconds',
  'final-link-wrapper',
  'linkjust-progress-marker',
] as const;
const WP_TIMER_SEL =
  '#next-timer-btn,#linkjust-timer,#timer_seconds,#mdtimer,#linkjust-progress-marker';

function isLinkjustHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'linkjust.com' || h.endsWith('.linkjust.com');
}

function isTimerChainTemplate(doc: Document): boolean {
  if (doc.querySelector(WP_TIMER_SEL)) return true;
  if (doc.querySelector('#final-link-wrapper')) return true;
  if (doc.querySelector('a#next-timer-btn')) return true;
  if (doc.querySelector('a[href*="ViewArticle="],a[href*="viewarticle="]')) return true;
  const html = doc.documentElement.innerHTML;
  if (CHAIN_HTML_MARKERS.some((s) => html.includes(s))) return true;
  return /ViewArticle=|viewarticle=/i.test(html);
}

function isAdShell(doc: Document): boolean {
  return !!doc.querySelector(AD_SHELL_SEL);
}

function isShortSlugPath(): boolean {
  try {
    const u = new URL(window.location.href);
    if (!isLinkjustHost(u.hostname)) return false;
    const seg = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
    if (!seg || seg.includes('.') || !/^[A-Za-z0-9]+$/.test(seg)) return false;
    if (seg.length < 6 || seg.length > 80) return false;
    return /[0-9]/.test(seg) || seg.length >= 12;
  } catch {
    return false;
  }
}

function normPath(pathname: string): string {
  const s = pathname.replace(/\/+$/, '').toLowerCase();
  return s === '' ? '/' : s;
}

function shouldFollowHop(urlStr: string): boolean {
  try {
    const t = new URL(urlStr, window.location.origin);
    const p = t.protocol.toLowerCase();
    if (p !== 'http:' && p !== 'https:') return false;
    const cur = new URL(window.location.href);
    if (t.origin !== cur.origin) return true;
    if (normPath(t.pathname) === normPath(cur.pathname)) return false;
    return `${t.pathname}${t.search}` !== `${cur.pathname}${cur.search}`;
  } catch {
    return false;
  }
}

function normUrl(urlStr: string): string {
  try {
    const x = new URL(urlStr, window.location.origin);
    x.hash = '';
    return `${x.protocol}//${x.host}${x.pathname}${x.search}`.toLowerCase();
  } catch {
    return '';
  }
}

function isOffDomain(urlStr: string): boolean {
  try {
    const a = new URL(urlStr, window.location.origin).hostname.toLowerCase();
    const b = new URL(window.location.href).hostname.toLowerCase();
    return a !== b;
  } catch {
    return false;
  }
}

function isLinkjustUrl(urlStr: string): boolean {
  try {
    return isLinkjustHost(new URL(urlStr).hostname);
  } catch {
    return false;
  }
}

function collectFromDom(): string[] {
  const q = <T extends Element>(s: string) => [...document.querySelectorAll<T>(s)];
  return [
    document.querySelector<HTMLAnchorElement>('a#final-link-wrapper')?.href,
    ...q<HTMLAnchorElement>('a[href*="ViewArticle="],a[href*="viewarticle="]').map((e) => e.href),
    document.querySelector<HTMLAnchorElement>('a#next-timer-btn')?.href,
    ...q<HTMLAnchorElement>('a[href^="https://linkjust.com/"],a[href^="http://linkjust.com/"]').map(
      (e) => e.href,
    ),
  ].filter((x): x is string => Boolean(x));
}

function collectFromEscaped(html: string): string[] {
  const raw: string[] = [];
  const va =
    /https:\\\/\\\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}[^'"\\]*(?:\\?|&)(?:ViewArticle|viewarticle)=[\w-]+/gi;
  let m: RegExpExecArray | null;
  while ((m = va.exec(html)) !== null) raw.push(m[0].replace(/\\\//g, '/'));
  const lj = /https:\\\/\\\/linkjust\.com\\\/[a-zA-Z0-9]+/gi;
  while ((m = lj.exec(html)) !== null) raw.push(m[0].replace(/\\\//g, '/'));
  return raw;
}

function collectBareLj(html: string): string[] {
  const raw: string[] = [];
  const re = /https:\/\/linkjust\.com\/[a-zA-Z0-9]+(?:\?[^"'<>\s]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const s = m[0].replace(/[),.;]+$/, '');
    const base = s.split('?')[0];
    if (base && /^https:\/\/linkjust\.com\/[a-zA-Z0-9]+\/?$/i.test(base)) raw.push(s);
  }
  return raw;
}

function collectFromHtml(html: string): string[] {
  const raw: string[] = [];
  const va =
    /https:\/\/[a-z0-9][a-z0-9.-]*\.[a-z]{2,}[^\s"'<>]*(?:\?|&)(?:ViewArticle|viewarticle)=[\w-]+/gi;
  let m: RegExpExecArray | null;
  while ((m = va.exec(html)) !== null) raw.push(m[0]);
  const fw1 = html.match(/id=["']final-link-wrapper["'][^>]*href=["'](https:[^"']+)["']/i);
  const fw2 = html.match(/href=["'](https:[^"']+)["'][^>]*id=["']final-link-wrapper["']/i);
  for (const x of [fw1?.[1], fw2?.[1]]) if (x) raw.push(x);
  raw.push(...collectBareLj(html), ...collectFromEscaped(html));
  return raw;
}

function dedupeValid(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!shouldFollowHop(u)) continue;
    const n = normUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(u);
  }
  return out;
}

function pickForward(valid: string[]): string | null {
  const ref = document.referrer ? normUrl(document.referrer) : '';
  const off = valid.filter(isOffDomain);
  const head = [...off.filter(isLinkjustUrl), ...off.filter((u) => !isLinkjustUrl(u))][0];
  if (head) return head;
  for (const u of valid) {
    if (isOffDomain(u)) continue;
    const n = normUrl(u);
    if (!ref || n !== ref) return u;
  }
  return null;
}

function extractNextHop(): string | null {
  const html = document.documentElement.innerHTML;
  return pickForward(dedupeValid([...collectFromDom(), ...collectFromHtml(html)]));
}

function runHopBypass(): void {
  const onLj = isAllowedHost(LINKJUST);
  const tpl = isTimerChainTemplate(document);
  const short = onLj && isShortSlugPath();
  if (!tpl && !short) return;
  let done = false;
  const tryGo = (): boolean => {
    if (done) return true;
    const next = extractNextHop();
    if (!next) return false;
    if (onLj && !isTimerChainTemplate(document) && isLinkjustUrl(next)) return false;
    done = true;
    window.location.replace(next);
    return true;
  };
  const observer = new MutationObserver(() => {
    if (tryGo()) observer.disconnect();
  });
  chrome.runtime.sendMessage({ type: 'INJECT_VISIBILITY_SPOOF' }).catch(() => {});
  if (tryGo()) return;
  observer.observe(document.documentElement, OBS_HOP);
  let micro = 0;
  const microBurst = (): void => {
    if (done) return;
    if (tryGo()) return void observer.disconnect();
    if (++micro < 48) queueMicrotask(microBurst);
  };
  queueMicrotask(microBurst);
  let frames = 0;
  const raf = (): void => {
    if (done) return;
    if (tryGo()) return void observer.disconnect();
    if (++frames < 960) requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

export function initLinkjustTimerChainBypass(): void {
  whenDomParsed(() => {
    const onLj = isAllowedHost(LINKJUST);
    if (onLj) {
      if (!isShortSlugPath() && !isTimerChainTemplate(document) && !isAdShell(document)) return;
      if (isAdShell(document)) attachAdlinkflyLinksGo();
      else runHopBypass();
      return;
    }
    if (!isTimerChainTemplate(document)) return;
    runHopBypass();
  });
}
