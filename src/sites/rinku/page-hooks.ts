export function runRinkuPageHooks(): void {
  const w = window as unknown as Record<string, unknown>;
  const noop = (): void => {};

  for (const [name, value] of [
    ['muzammil', true],
    ['tabSwitched', true],
    ['tabSwitchedTime', Date.now() - 120_000],
    ['redirectToErrorPage', noop],
  ] as const) {
    Object.defineProperty(w, name, {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: noop,
    });
  }

  sessionStorage.setItem('mustClickAd1', '0');
  if (!w.__skipWaitRinkuStorage) {
    w.__skipWaitRinkuStorage = true;
    const ss = sessionStorage;
    const get = ss.getItem.bind(ss);
    const set = ss.setItem.bind(ss);
    ss.getItem = (key) => (key === 'mustClickAd1' ? '0' : get(key));
    ss.setItem = (key, value) => set(key, key === 'mustClickAd1' ? '0' : value);
  }

  document.cookie = 'adScriptCooldown=1; path=/; max-age=3600';

  Object.defineProperty(Document.prototype, 'hasFocus', {
    value: () => true,
    configurable: true,
    writable: true,
  });

  if (!w.__skipWaitRinkuClickGuard) {
    w.__skipWaitRinkuClickGuard = true;
    document.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('button')) {
          event.stopImmediatePropagation();
        }
      },
      true,
    );
  }
}
