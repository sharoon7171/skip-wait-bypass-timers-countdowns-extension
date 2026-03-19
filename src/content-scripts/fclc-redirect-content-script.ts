import { isAllowedHost } from '../utils/domain-check';
import { isCaptchaVerified } from '../utils/captcha-verifier';
import { isCloudflareHumanVerificationDone } from '../utils/cloudflare-verifier';

const CAPTCHA_IN_FORM = '[name="h-captcha-response"], [name="g-recaptcha-response"]';
const HOSTS = ['fc-lc.xyz', 'fc.lc', 'oii.io'];
const LINK_VIEW = '#link-view';
const MSG_FCLC_ALERT_SUPPRESS = 'FCLC_ALERT_SUPPRESS';
const SUBMIT_BTN = '#submitBtn';
const VERIFICATION_FORMS = ['#verificationForm', '#verificationFormm'];

const TICK_MS = 100;
const SCROLL_EVERY = 5;
const MAX_TICKS = 600;

function getVerificationForm(): HTMLFormElement | null {
  for (const sel of VERIFICATION_FORMS) {
    const el = document.querySelector<HTMLFormElement>(sel);
    if (el) return el;
  }
  return null;
}

function simulateActivity(form: HTMLFormElement): () => void {
  let n = 0;
  let tid = 0;
  const stop = (): void => {
    if (tid) clearInterval(tid);
    tid = 0;
  };
  tid = window.setInterval(() => {
    if (!document.contains(form) || n >= MAX_TICKS) {
      stop();
      return;
    }
    n++;
    const x = 80 + (n % 120);
    const y = 80 + ((n * 7) % 120);
    form.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
    if (n % SCROLL_EVERY === 0) {
      window.scrollBy(0, 1);
      window.scrollBy(0, -1);
    }
  }, TICK_MS);
  return stop;
}

function runCloudflarePart(form: HTMLFormElement): void {
  const btn = document.querySelector<HTMLButtonElement>(SUBMIT_BTN);
  if (!btn) return;
  const stopActivity = simulateActivity(form);
  let done = false;
  const check = (): void => {
    if (done || !isCloudflareHumanVerificationDone(form) || btn.disabled) return;
    done = true;
    stopActivity();
    obs.disconnect();
    requestAnimationFrame(() => btn.click());
  };
  const obs = new MutationObserver(check);
  obs.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  obs.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
  check();
}

function runHcaptchaPart(form: HTMLFormElement): void {
  if (!form.querySelector(CAPTCHA_IN_FORM)) return;
  let done = false;
  const check = (): void => {
    if (done || !isCaptchaVerified(form)) return;
    done = true;
    obs.disconnect();
    form.submit();
  };
  const obs = new MutationObserver(check);
  obs.observe(form, { childList: true, subtree: true, attributes: true });
  check();
}

function run(): void {
  const linkView = document.querySelector<HTMLFormElement>(LINK_VIEW);
  if (linkView) {
    runHcaptchaPart(linkView);
    return;
  }
  const verificationForm = getVerificationForm();
  if (verificationForm) runCloudflarePart(verificationForm);
}

export function initFclcRedirect(): void {
  if (!isAllowedHost(HOSTS)) return;
  chrome.runtime.sendMessage({ type: MSG_FCLC_ALERT_SUPPRESS }).catch(() => {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
