export function pageHtml(): string {
  return document.documentElement?.innerHTML ?? '';
}

export function hasWolfexeVerifyUi(root: ParentNode = document): boolean {
  return Boolean(
    root.querySelector('#wolfexe-time, #wolfexe-wait1, #co-time, #wolfexe-snp, #go_d'),
  );
}

export function hasMoobiedatVerifyUi(root: ParentNode = document): boolean {
  return Boolean(
    root.querySelector('#seconds, #nextBtn, #progress, .moobiedat-container, #redirectBtn'),
  );
}

export function isWolfexeMediatorShell(html: string = pageHtml()): boolean {
  if (hasWolfexeVerifyUi()) return true;
  if (html.length < 800) return false;
  return /#wolfexe-time|#co-time|id=["']go_d["']|wolfexe-wait1/i.test(html);
}

export function isMoobiedatMediatorShell(html: string = pageHtml()): boolean {
  if (hasMoobiedatVerifyUi()) return true;
  if (html.length < 800) return false;
  return /moobiedat-container|id=["']nextBtn["']|Please\s*Wait\s*N?\s*Seconds/i.test(html);
}

export function isMediatorShell(html: string = pageHtml()): boolean {
  return isWolfexeMediatorShell(html) || isMoobiedatMediatorShell(html);
}

export function aliasFromMediatorQuery(): string | null {
  const alias = new URLSearchParams(location.search).get('alias')?.trim();
  if (!alias || alias.length < 4) return null;
  return alias;
}

export function shortenerAliasFromHtml(html: string = pageHtml()): string | null {
  const m = html.match(/(?:shr2\.link|nitro-link\.com)\/([A-Za-z0-9]{4,})/i);
  return m?.[1] ?? null;
}
