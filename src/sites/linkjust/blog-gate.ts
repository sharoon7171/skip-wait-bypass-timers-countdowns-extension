import { hostnameMatches, whenDomParsed } from '../../utils/domain-check';
import { LINKJUST_ALIAS_RE, LINKJUST_HOSTS, LINKJUST_ORIGIN } from './hosts';

const FINAL_LINK_SEL =
  'a[id$="-final-link-wrapper"][href*="linkjust.com"], a#next-link-wrapper[href*="linkjust.com"]';
const GATE_MARKERS = '#linkjust-timer, #next-timer-btn, [id^="linkjust-"][id$="-final-link-wrapper"]';
const RENDER_HINT = 'linkjustRenderThreeButtonProgress';
const SHORT_URL_RE = /https?:\/\/(?:www\.)?linkjust\.com\/([A-Za-z0-9]+)/i;

let done = false;

const shortUrlForAlias = (alias: string): string => `${LINKJUST_ORIGIN}/${alias}`;

const aliasFromSearch = (): string | null => {
  const raw = new URLSearchParams(location.search).get('GetArticle')?.trim() ?? '';
  return LINKJUST_ALIAS_RE.test(raw) ? raw : null;
};

const aliasFromHref = (href: string): string | null => {
  try {
    const u = new URL(href);
    if (!hostnameMatches(u.hostname, LINKJUST_HOSTS)) return null;
    const alias = u.pathname.replace(/^\/+|\/+$/g, '');
    return LINKJUST_ALIAS_RE.test(alias) ? alias : null;
  } catch {
    return null;
  }
};

const aliasFromDom = (): string | null => {
  for (const a of document.querySelectorAll<HTMLAnchorElement>(FINAL_LINK_SEL)) {
    const alias = aliasFromHref(a.href);
    if (alias) return alias;
  }
  const html = document.documentElement?.innerHTML ?? '';
  if (!html.includes('linkjust')) return null;
  const m = html.match(SHORT_URL_RE);
  return m?.[1] && LINKJUST_ALIAS_RE.test(m[1]) ? m[1] : null;
};

const looksLikeGate = (): boolean => {
  if (aliasFromSearch()) return true;
  if (document.querySelector(GATE_MARKERS)) return true;
  for (const s of document.scripts) {
    if (s.textContent?.includes(RENDER_HINT)) return true;
  }
  return !!document.querySelector(FINAL_LINK_SEL);
};

const resolveShortUrl = (): string | null => {
  const fromSearch = aliasFromSearch();
  if (fromSearch) return shortUrlForAlias(fromSearch);
  const fromDom = aliasFromDom();
  return fromDom ? shortUrlForAlias(fromDom) : null;
};

const leaveGate = (): boolean => {
  if (done) return true;
  const url = resolveShortUrl();
  if (!url) return false;
  done = true;
  location.replace(url);
  return true;
};

export function initLinkjustBlogGate(): void {
  if (hostnameMatches(location.hostname, LINKJUST_HOSTS)) return;

  const fromSearch = aliasFromSearch();
  if (fromSearch) {
    leaveGate();
    return;
  }

  const tryLeave = (): void => {
    if (!looksLikeGate()) return;
    leaveGate();
  };

  whenDomParsed(tryLeave);
  if (done) return;

  const mo = new MutationObserver(() => {
    tryLeave();
    if (done) mo.disconnect();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
