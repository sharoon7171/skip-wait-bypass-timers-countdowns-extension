export function installArolinksUnlockGuard(): void {
  const root = window as Window & { __swAroUnlockGuard?: { active: boolean } };
  if (root.__swAroUnlockGuard) {
    root.__swAroUnlockGuard.active = true;
    return;
  }
  const state = { active: true };
  root.__swAroUnlockGuard = state;
  document.addEventListener('__sw_aro_unlock_done', () => {
    state.active = false;
  });
  const allow = (url: string) =>
    !state.active || String(url).includes('arolinks.com') || String(url).includes('deltastudy.site');
  const hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  if (hrefDesc?.set) {
    Object.defineProperty(Location.prototype, 'href', {
      configurable: true,
      get() {
        return hrefDesc.get!.call(this);
      },
      set(v: string) {
        if (!allow(v)) return;
        hrefDesc.set!.call(this, v);
      },
    });
  }
  const proto = Location.prototype as Location & {
    assign?: (url: string) => void;
    replace?: (url: string) => void;
  };
  const origAssign = proto.assign?.bind(proto);
  const origReplace = proto.replace?.bind(proto);
  if (origAssign) {
    proto.assign = (url: string) => {
      if (!allow(url)) return;
      origAssign(url);
    };
  }
  if (origReplace) {
    proto.replace = (url: string) => {
      if (!allow(url)) return;
      origReplace(url);
    };
  }
}

export function releaseArolinksUnlockGuard(): void {
  document.dispatchEvent(new Event('__sw_aro_unlock_done'));
}
