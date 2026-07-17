const isHttpUrl = (href: string): boolean => /^https?:\/\//i.test(href);

const isRedeemUrl = (href: string): boolean => /(?:[?&])access_key=/i.test(href);

export function redeemUrlFromProlinkCookie(value: string): string | null {
  try {
    const raw = decodeURIComponent(value.trim());
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const dest = atob(padded).trim();
    if (!isHttpUrl(dest) || !isRedeemUrl(dest)) return null;
    if (/(?:[?&])rk_ref=/.test(dest)) return dest;
    return `${dest}${dest.includes('?') ? '&' : '?'}rk_ref=1`;
  } catch {
    return null;
  }
}
