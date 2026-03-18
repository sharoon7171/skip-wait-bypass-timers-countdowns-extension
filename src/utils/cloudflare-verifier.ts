const TURNSTILE_RESPONSE_SELECTOR = '[name="cf-turnstile-response"]';
const CF_CLEARANCE_REGEX = /\bcf_clearance=([^;]+)/;

function getTurnstileToken(root: Document | Element): string | null {
  const value = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(TURNSTILE_RESPONSE_SELECTOR)?.value?.trim();
  return value?.length ? value : null;
}

function getCfClearance(): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  return document.cookie.match(CF_CLEARANCE_REGEX)?.[1] ?? null;
}

export function isCloudflareHumanVerificationDone(container?: Element): boolean {
  const root = container ?? document;
  return getTurnstileToken(root) !== null || getCfClearance() !== null;
}
