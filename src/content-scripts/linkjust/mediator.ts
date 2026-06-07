import { isLinkjustHost } from './hosts';

const TIMER_SEL =
  '#linkjust-timer,#mdtimer,#timer_seconds,#next-timer-btn,#final-link-wrapper,#next-link-wrapper';

const TIMER_HTML =
  /id=["'](?:linkjust-timer|mdtimer|timer_seconds|next-timer-btn|final-link-wrapper|next-link-wrapper)["']/i;

const LINKJUST_SHELL = /linkjust(?:Init|RenderThreeButtonProgress|-timer)/i;

export function isLinkjustMediatorShell(
  doc: Document = document,
  html: string = doc.documentElement?.innerHTML ?? '',
): boolean {
  if (isLinkjustHost()) return false;
  if (doc.querySelector(TIMER_SEL)) return true;
  if (TIMER_HTML.test(html)) return true;
  return LINKJUST_SHELL.test(html) && /(?:GetArticle|ViewArticle)=/i.test(html);
}
