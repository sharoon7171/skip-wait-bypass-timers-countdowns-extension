const HEX32 = /^[a-f0-9]{32}$/i;

export const isCloudflareChallenge = (): boolean =>
  /just a moment/i.test(document.title) ||
  Boolean(document.querySelector('#challenge-error-text, #cf-challenge-running, .cf-challenge'));

export const isRinkuLandPath = (): boolean => /^\/rinku\/land\/?$/i.test(location.pathname);
export const isRinkuOutPath = (): boolean => /^\/rinku\/out\/?$/i.test(location.pathname);

export const rinkuHexForm = (): HTMLFormElement | null => {
  for (const form of document.querySelectorAll('form')) {
    if (!(form instanceof HTMLFormElement)) continue;
    const hidden = [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"]')].find(
      (el) => el.name && HEX32.test(el.name) && el.value && HEX32.test(el.value),
    );
    if (hidden && form.querySelector('button')) return form;
  }
  return null;
};

export const rinkuStepButton = (): HTMLButtonElement | null => {
  for (const btn of document.querySelectorAll('button')) {
    if (!(btn instanceof HTMLButtonElement)) continue;
    if (/step\s*\d+\s*\/\s*\d+/i.test(btn.textContent || '')) return btn;
  }
  return null;
};

export const rinkuCaptchaForm = (): HTMLFormElement | null => {
  for (const form of document.querySelectorAll('form')) {
    if (form instanceof HTMLFormElement && form.querySelector('#captcha-container')) return form;
  }
  return null;
};

export const rinkuCaptchaWidget = (): HTMLElement | null =>
  document.getElementById('captcha-container');

export const rinkuUnlockForm = (): HTMLFormElement | null => {
  const form = rinkuStepButton()?.closest('form');
  return form instanceof HTMLFormElement ? form : null;
};

export const isRinkuCaptchaGate = (): boolean =>
  !isCloudflareChallenge() &&
  Boolean(rinkuCaptchaForm() && rinkuCaptchaWidget() && rinkuStepButton());

export const isRinkuCountdownGate = (): boolean =>
  !isCloudflareChallenge() &&
  !isRinkuCaptchaGate() &&
  Boolean(
    rinkuUnlockForm() &&
      document.getElementById('redirect-link') &&
      document.getElementById('redirect-message') &&
      document.getElementById('count'),
  );
