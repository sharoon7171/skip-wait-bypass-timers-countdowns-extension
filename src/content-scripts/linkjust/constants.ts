export const ARTICLE_QS = '(?:GetArticle|ViewArticle)';

const ARTICLE_IN_URL = new RegExp(`${ARTICLE_QS}=`, 'i');
const ARTICLE_ALIAS = new RegExp(`${ARTICLE_QS}=([^&"'#\\s]+)`, 'i');

export function isArticleChainUrl(urlStr: string): boolean {
  return ARTICLE_IN_URL.test(urlStr);
}

export function articleAliasFromUrl(href: string): string | null {
  try {
    const q = new URL(href).searchParams;
    for (const key of ['GetArticle', 'ViewArticle']) {
      const v = q.get(key)?.trim();
      if (v && v.length >= 4) return v;
    }
  } catch {}
  return null;
}

export function articleAliasFromHtml(html: string): string | null {
  const v = html.match(ARTICLE_ALIAS)?.[1]?.trim();
  return v && v.length >= 4 ? v : null;
}
