const REPO_ISSUES_NEW = 'https://github.com/sharoon7171/skip-wait-bypass-timers-countdowns/issues/new';

export const CHROME_WEB_STORE_LISTING_URL =
  'https://chromewebstore.google.com/detail/hdoecnlghjglmnjpnhaaeofcgocdgkhd';

export const CONTACT = {
  email: 'sharoon7171@gmail.com',
  telegram: 'https://t.me/sharoon1998',
} as const;

export function getRequestSupportUrl(): string {
  const u = new URL(REPO_ISSUES_NEW);
  u.searchParams.set('template', 'request_support.yml');
  u.searchParams.set('labels', 'request-support');
  return u.toString();
}
