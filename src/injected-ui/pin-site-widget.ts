import { overlayActiveClass } from './overlay-styles';

export type PinSiteWidgetOptions = {
  overlayId: string;
  mount: HTMLElement;
  widgetId: string;
  styleId: string;
  alsoVisibleSelectors?: readonly string[];
};

export function pinSiteWidgetOverOverlay(options: PinSiteWidgetOptions): () => void {
  const { overlayId, mount, widgetId, styleId, alsoVisibleSelectors = [] } = options;
  const activeClass = overlayActiveClass(overlayId);

  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.documentElement.appendChild(style);
  }

  const alsoCss = alsoVisibleSelectors
    .map(
      (sel) =>
        `html.${activeClass} ${sel},html.${activeClass} ${sel} *{visibility:visible!important;pointer-events:auto!important}`,
    )
    .join('');

  let lastKey = '';
  let missingSince = 0;

  const paint = (): void => {
    const box = document.getElementById(widgetId);
    if (!box) {
      if (!missingSince) missingSince = Date.now();
      if (Date.now() - missingSince > 3000) style!.textContent = '';
      return;
    }
    missingSince = 0;
    box.classList.remove('hidden');
    const r = mount.getBoundingClientRect();
    const top = Math.round(Math.max(8, r.top));
    const left = Math.round(Math.max(8, r.left));
    const width = Math.round(Math.max(300, r.width || 300));
    const key = `${top}|${left}|${width}`;
    if (key === lastKey && style!.textContent) return;
    lastKey = key;
    style!.textContent =
      alsoCss +
      `html.${activeClass} #${widgetId},html.${activeClass} #${widgetId} *{visibility:visible!important;pointer-events:auto!important}` +
      `html.${activeClass} #${widgetId}{position:fixed!important;left:${left}px!important;top:${top}px!important;width:${width}px!important;min-height:70px!important;z-index:2147483647!important;display:block!important;margin:0!important;transform:none!important;opacity:1!important;height:auto!important}`;
  };

  paint();
  const ro = new ResizeObserver(paint);
  ro.observe(mount);
  window.addEventListener('resize', paint);
  const tid = window.setInterval(paint, 500);
  return () => {
    ro.disconnect();
    window.removeEventListener('resize', paint);
    window.clearInterval(tid);
    style?.remove();
  };
}
