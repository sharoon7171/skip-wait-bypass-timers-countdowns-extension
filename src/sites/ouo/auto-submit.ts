import { isAllowedHost, whenDomParsed } from '../../utils/domain-check';
import { OUO_HOSTS } from './hosts';

const FORM = '#form-captcha';
const TURNSTILE = '[name="cf-turnstile-response"]';

let done = false;

function captchaForm(): HTMLFormElement | null {
  const form = document.querySelector<HTMLFormElement>(FORM);
  if (!form) return null;
  const action = form.getAttribute('action') || form.action || '';
  if (!/\/(?:go|x)\//i.test(action)) return null;
  return form;
}

function turnstileReady(form: HTMLFormElement): boolean {
  const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(TURNSTILE);
  if (!el) return true;
  const v = el.value?.trim() ?? '';
  return v.length > 20;
}

function submitWhenReady(form: HTMLFormElement): void {
  if (done) return;
  const tick = (): void => {
    if (done) return;
    if (!document.contains(form)) return;
    if (!turnstileReady(form)) {
      window.setTimeout(tick, 150);
      return;
    }
    done = true;
    form.submit();
  };
  tick();
}

function run(): void {
  const form = captchaForm();
  if (!form) return;
  submitWhenReady(form);
}

export function initOuoBypass(): void {
  if (!isAllowedHost(OUO_HOSTS)) return;
  whenDomParsed(run);
}
