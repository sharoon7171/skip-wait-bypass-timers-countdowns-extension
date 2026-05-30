const CLICK_SEL =
  '#next-timer-btn,#mid-nextbutton,#final-nextbutton,#nextbutton,#final-link-wrapper,#next-link-wrapper';

export function dismissLinkjustAdblockOverlay(): void {
  for (const el of document.querySelectorAll('.popSc')) el.remove();
}

export function nudgeLinkjustTimerUi(): void {
  dismissLinkjustAdblockOverlay();
  const sec = document.querySelector('#timer_seconds');
  if (sec) sec.textContent = '0';
  for (const el of document.querySelectorAll<HTMLElement>(CLICK_SEL)) {
    if (el instanceof HTMLButtonElement && el.disabled) continue;
    if (el instanceof HTMLAnchorElement) {
      const btn = el.querySelector('button[disabled]');
      if (btn) continue;
    } else if (el.style.display === 'none') {
      continue;
    }
    try {
      el.click();
    } catch {}
  }
}
