export function hostnameMatches(hostname: string, roots: readonly string[]): boolean {
  const h = hostname.toLowerCase();
  return roots.some((d) => h === d || h.endsWith('.' + d));
}

export function isAllowedHost(allowed: readonly string[]): boolean {
  try {
    return hostnameMatches(new URL(window.location.href).hostname, allowed);
  } catch {
    return false;
  }
}

export function whenDomParsed(run: () => void): void {
  if (document.readyState !== 'loading') {
    run();
    return;
  }
  document.addEventListener('readystatechange', function onParsed() {
    if (document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', onParsed);
    run();
  });
}

export function whenDomReady(check: () => boolean): Promise<void> {
  if (check()) return Promise.resolve();
  return new Promise((resolve) => {
    const mo = new MutationObserver(() => {
      if (!check()) return;
      mo.disconnect();
      resolve();
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
  });
}
