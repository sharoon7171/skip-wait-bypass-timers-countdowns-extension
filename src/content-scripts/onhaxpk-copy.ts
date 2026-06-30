import { isAllowedHost } from '../utils/domain-check';
import { cardActionsRow, cardButton, createInlineCard } from '../injected-ui/card';

const HOSTS = ['onhaxpk.net'] as const;
const CARD_ID = 'skipwait-onhax-card';
const COOKIE_EDITOR_RE = /<xmp>\[\s*([\s\S]*?)<\/xmp>/;
const SESSION_PASTE_RE = /session_paste\s+([A-Za-z0-9+/=]+)/;

function bindCopy(btn: HTMLButtonElement, text: string | null, label: string): void {
  if (!text) return;
  btn.disabled = false;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = label; }, 2000);
    } catch {
      btn.textContent = '! Failed';
    }
  };
}

function parsePage(html: string): { session: string | null; editor: string | null } {
  const mSession = html.match(SESSION_PASTE_RE);
  const mEditor = html.match(COOKIE_EDITOR_RE);
  return {
    session: mSession?.[1] ? `session_paste ${mSession[1]}` : null,
    editor: mEditor?.[1] ? `[${mEditor[1].trim()}]` : null,
  };
}

function run(): void {
  if (document.getElementById(CARD_ID)) return;
  const timerEl = document.querySelector('.uael-countdown-wrapper, [class*="countdown"], [id*="countdown"], [class*="timer"]');
  const insertAfter = timerEl?.closest('.elementor-section') ?? timerEl?.parentElement;
  if (!insertAfter?.parentNode) return;

  const card = createInlineCard({
    id: CARD_ID,
    badge: 'Skip Wait extension',
    title: 'Countdown bypassed - cookie ready',
    description:
      'This box was added by the <strong>Skip Wait</strong> extension. We skipped the countdown and loaded the cookie for you. Pick a format below and copy - no ads, no wait.',
    status: 'Loading…',
    actionsHtml: cardActionsRow(
      `${cardButton('skipwait-onhax-session', '📋 Session share', true)}${cardButton('skipwait-onhax-editor', '📋 Cookie Editor', true)}`,
    ),
  });
  insertAfter.parentNode.insertBefore(card.root, insertAfter.nextSibling);
  card.root.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const btnSession = card.button('skipwait-onhax-session')!;
  const btnEditor = card.button('skipwait-onhax-editor')!;

  fetch(window.location.href, { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      const { session, editor } = parsePage(html);
      bindCopy(btnSession, session, '📋 Session share');
      bindCopy(btnEditor, editor, '📋 Cookie Editor');
      if (session || editor) {
        card.setStatus('Cookie loaded by Skip Wait. Choose a format and click to copy.', 'success');
      } else {
        card.setStatus('Could not find cookies on page.', 'error');
      }
      card.root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
    .catch(() => {
      card.setStatus('Failed to load page.', 'error');
      card.root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

export function initOnhaxpkCopy(): void {
  if (!isAllowedHost(HOSTS)) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
