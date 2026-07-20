export const STORYLINE_SCORM_HOSTS = ['mrtzn.com'] as const;

export function isStorylineScormUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (!STORYLINE_SCORM_HOSTS.some((d) => h === d || h.endsWith('.' + d))) return false;
    return u.pathname.includes('index_lms.html') || u.pathname.includes('package_uploads');
  } catch {
    return false;
  }
}
