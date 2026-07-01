import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';

const HOSTS = ['onhaxpk.net'] as const;
const ROOT_ID = 'skipwait-onhaxpk';
const COOKIE_EDITOR_RE = /<xmp>\[\s*([\s\S]*?)<\/xmp>/;
const SESSION_PASTE_RE = /session_paste\s+([A-Za-z0-9+/=]+)/;

type Payload = { session: string | null; editor: string | null };

const parse = (html: string): Payload => {
  const s = SESSION_PASTE_RE.exec(html);
  const e = COOKIE_EDITOR_RE.exec(html);
  return {
    session: s?.[1] ? `session_paste ${s[1]}` : null,
    editor: e?.[1] ? `[${e[1].trim()}]` : null,
  };
};

const clipboardIcon = (): SVGSVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const board = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  board.setAttribute('d', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2');
  const clip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clip.setAttribute('width', '8');
  clip.setAttribute('height', '4');
  clip.setAttribute('x', '8');
  clip.setAttribute('y', '2');
  clip.setAttribute('rx', '1');
  svg.append(clip, board);
  return svg;
};

const makeBtn = (label: string): { root: HTMLElement; button: HTMLButtonElement; text: HTMLElement } => {
  const root = document.createElement('div');
  root.className = 'elementor-element elementor-align-center elementor-widget elementor-widget-button';
  root.style.cssText = 'width:100%;max-width:360px;margin-inline:auto';
  const container = document.createElement('div');
  container.className = 'elementor-widget-container';
  const wrapper = document.createElement('div');
  wrapper.className = 'elementor-button-wrapper';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'elementor-button elementor-size-sm';
  button.disabled = true;
  const content = document.createElement('span');
  content.className = 'elementor-button-content-wrapper';
  const icon = document.createElement('span');
  icon.className = 'elementor-button-icon elementor-align-icon-left';
  icon.append(clipboardIcon());
  const text = document.createElement('span');
  text.className = 'elementor-button-text';
  text.textContent = label;
  content.append(icon, text);
  button.append(content);
  wrapper.append(button);
  container.append(wrapper);
  root.append(container);
  return { root, button, text };
};

const makeNotice = (): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'elementor-element elementor-align-center elementor-widget elementor-widget-heading';
  root.style.cssText = 'width:100%;margin-bottom:8px';
  const container = document.createElement('div');
  container.className = 'elementor-widget-container';
  const box = document.createElement('div');
  box.style.cssText =
    'max-width:520px;margin:0 auto 16px;padding:16px 20px;border-radius:12px;background:#f7f7f8;border:1px solid #dfdee3;text-align:center';
  const title = document.createElement('h4');
  title.className = 'elementor-heading-title';
  title.style.cssText = 'margin:0 0 8px;color:#26222f;font-size:20px;font-weight:700';
  title.textContent = 'Countdown bypassed';
  const detail = document.createElement('p');
  detail.style.cssText = 'margin:0;color:#4c455f;font-size:16px;line-height:1.5';
  detail.textContent = 'Skip Wait skipped the wait timer. Copy your cookie data below.';
  box.append(title, detail);
  container.append(box);
  root.append(container);
  return root;
};

const bind = (text: HTMLElement, value: string | null, label: string): void => {
  const button = text.closest('button');
  if (!value || !button) return;
  button.disabled = false;
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      text.textContent = 'Copied!';
      setTimeout(() => {
        text.textContent = label;
      }, 2000);
    } catch {
      text.textContent = 'Copy failed';
    }
  };
};

let mounted = false;

function run(): void {
  if (mounted) return;
  const mount = document.querySelector('.elementor-widget-uael-countdown')?.closest('.elementor-widget-wrap');
  if (!mount) return;
  mounted = true;

  document.querySelector('.elementor-widget-uael-countdown')?.closest('.elementor-element')?.remove();
  document.querySelector('.elementor-widget-animated-headline')?.closest('.elementor-element')?.remove();
  document.querySelectorAll('.elementor-invisible').forEach((el) => el.classList.remove('elementor-invisible'));

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.cssText = 'width:100%;display:flex;flex-direction:column;align-items:center;text-align:center';
  const session = makeBtn('Session share');
  const editor = makeBtn('Cookie Editor');
  root.append(makeNotice(), session.root, editor.root);
  mount.prepend(root);

  const apply = (html: string): void => {
    const data = parse(html);
    bind(session.text, data.session, 'Session share');
    bind(editor.text, data.editor, 'Cookie Editor');
  };

  apply(document.documentElement.innerHTML);
  if (session.button.disabled && editor.button.disabled) {
    void fetch(location.href, { cache: 'no-store', credentials: 'same-origin' })
      .then((r) => r.text())
      .then(apply)
      .catch(() => {});
  }
}

export function initOnhaxpkCopy(): void {
  if (!isAllowedHost(HOSTS)) return;
  whenDomParsed(() => {
    run();
    setTimeout(run, 0);
  });
}
