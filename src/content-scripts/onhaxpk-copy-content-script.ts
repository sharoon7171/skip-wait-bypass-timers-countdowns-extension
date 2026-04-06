import { isAllowedHost } from '../utils/domain-check';
import { SKIPWAIT_CARD_STYLES } from '../utils/skipwait-card-styles';

const ALLOWED_HOSTS = ['onhaxpk.net'];
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

  const s = SKIPWAIT_CARD_STYLES;
  const card = document.createElement('div');
  card.id = CARD_ID;
  card.setAttribute('style', s.card);
  card.innerHTML = [
    `<div style="${s.badge}">Skip Wait extension</div>`,
    `<h3 style="${s.title}">Countdown bypassed - cookie ready</h3>`,
    `<p style="${s.description}">This box was added by the <strong>Skip Wait</strong> extension. We skipped the countdown and loaded the cookie for you. Pick a format below and copy - no ads, no wait.</p>`,
    `<p style="${s.status}" id="skipwait-onhax-status">Loading…</p>`,
    `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">`,
    `<button type="button" style="${s.btn}" id="skipwait-onhax-session" disabled>📋 Session share</button>`,
    `<button type="button" style="${s.btn}" id="skipwait-onhax-editor" disabled>📋 Cookie Editor</button>`,
    `</div>`,
  ].join('');
  insertAfter.parentNode.insertBefore(card, insertAfter.nextSibling);
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const status = document.getElementById('skipwait-onhax-status')!;
  const btnSession = document.getElementById('skipwait-onhax-session') as HTMLButtonElement;
  const btnEditor = document.getElementById('skipwait-onhax-editor') as HTMLButtonElement;

  fetch(window.location.href, { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      const { session, editor } = parsePage(html);
      bindCopy(btnSession, session, '📋 Session share');
      bindCopy(btnEditor, editor, '📋 Cookie Editor');
      if (session || editor) {
        status.setAttribute('style', s.statusSuccess);
        status.textContent = 'Cookie loaded by Skip Wait. Choose a format and click to copy.';
      } else {
        status.setAttribute('style', s.statusError);
        status.textContent = 'Could not find cookies on page.';
      }
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
    .catch(() => {
      status.setAttribute('style', s.statusError);
      status.textContent = 'Failed to load page.';
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

export function initOnhaxpkCopy(): void {
  if (!isAllowedHost(ALLOWED_HOSTS)) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
