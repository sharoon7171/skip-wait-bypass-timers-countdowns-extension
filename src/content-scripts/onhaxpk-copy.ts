import { isAllowedHost } from '../utils/domain-check';

const HOSTS = ['onhaxpk.net'] as const;
const ACTIONS_ID = 'skipwait-onhax-actions';
const COOKIE_EDITOR_RE = /<xmp>\[\s*([\s\S]*?)<\/xmp>/;
const SESSION_PASTE_RE = /session_paste\s+([A-Za-z0-9+/=]+)/;

function bindCopy(btn: HTMLButtonElement, text: string | null, label: string): void {
  if (!text) return;
  btn.disabled = false;
  btn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = label;
      }, 2000);
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
  if (document.getElementById(ACTIONS_ID)) return;
  const timerEl = document.querySelector('.uael-countdown-wrapper, [class*="countdown"], [id*="countdown"], [class*="timer"]');
  const insertAfter = timerEl?.closest('.elementor-section') ?? timerEl?.parentElement;
  if (!insertAfter?.parentNode) return;

  const wrap = document.createElement('div');
  wrap.id = ACTIONS_ID;
  const btnSession = document.createElement('button');
  btnSession.type = 'button';
  btnSession.id = 'skipwait-onhax-session';
  btnSession.textContent = '📋 Session share';
  btnSession.disabled = true;
  const btnEditor = document.createElement('button');
  btnEditor.type = 'button';
  btnEditor.id = 'skipwait-onhax-editor';
  btnEditor.textContent = '📋 Cookie Editor';
  btnEditor.disabled = true;
  wrap.append(btnSession, btnEditor);
  insertAfter.parentNode.insertBefore(wrap, insertAfter.nextSibling);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });

  fetch(window.location.href, { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      const { session, editor } = parsePage(html);
      bindCopy(btnSession, session, '📋 Session share');
      bindCopy(btnEditor, editor, '📋 Cookie Editor');
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    })
    .catch(() => {
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

export function initOnhaxpkCopy(): void {
  if (!isAllowedHost(HOSTS)) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
