import { isAllowedHost, whenDomParsed, whenDomReady } from '../../utils/domain-check';

export const STORYLINE_LMS_HOSTS = ['vocationaltraininghub.com'] as const;

const BRAND_ID = 'skipwait-storyline-brand';

function isCoursePlay(): boolean {
  return document.body.classList.contains('course-play');
}

function playerAnchor(): Element | null {
  return (
    document.querySelector('.video-box.videoplay iframe[src*="mrtzn.com"], .videoplay-new-scome-bar iframe[src*="index_lms"]')
      ?.closest('.video-box, .videoplay-new-scome-bar') ?? null
  );
}

function mountBrand(anchor: Element): void {
  if (document.getElementById(BRAND_ID)) return;

  const panel = document.createElement('div');
  panel.id = BRAND_ID;
  panel.className = 'card-panel green lighten-4';
  panel.setAttribute('role', 'status');

  const brand = document.createElement('strong');
  brand.className = 'black-text';
  brand.textContent = 'Skip Wait';

  const detail = document.createElement('span');
  detail.className = 'black-text';
  detail.textContent = ' — No more waiting on slides. Move on whenever you like.';

  panel.append(brand, detail);
  anchor.after(panel);
}

async function run(): Promise<void> {
  if (!isCoursePlay()) return;
  await whenDomReady(() => !!playerAnchor());
  const anchor = playerAnchor();
  if (anchor) mountBrand(anchor);
}

export function initStorylineCoursePlayBrand(): void {
  if (!isAllowedHost(STORYLINE_LMS_HOSTS)) return;
  whenDomParsed(() => void run());
}
