const ALIAS_PATH_RE = /^\/([A-Za-z0-9_-]{3,})\/?$/;
const GO_PATH_RE = /^\/go\/([A-Za-z0-9_-]+)\/?$/i;

export function cutyAliasFromPath(pathname = location.pathname): string | null {
  const go = GO_PATH_RE.exec(pathname);
  if (go?.[1]) return go[1];
  return ALIAS_PATH_RE.exec(pathname)?.[1] ?? null;
}

export function isCutyGatePath(pathname = location.pathname): boolean {
  return cutyAliasFromPath(pathname) !== null;
}

export function csrfFromHtml(html: string): string | null {
  const m =
    /name=["']_token["'][^>]*value=["']([^"']+)["']/i.exec(html) ||
    /value=["']([^"']+)["'][^>]*name=["']_token["']/i.exec(html);
  return m?.[1] ?? null;
}

export function goDataFromHtml(html: string): string | null {
  const m =
    /name=["']data["'][^>]*value=["']([^"']+)["']/i.exec(html) ||
    /value=["']([^"']+)["'][^>]*name=["']data["']/i.exec(html);
  return m?.[1] ?? null;
}

export function countdownSecFromHtml(html: string): number {
  const m = /countdownValue\s*=\s*(\d+)/.exec(html);
  return m?.[1] ? Math.max(0, parseInt(m[1], 10)) : 0;
}
