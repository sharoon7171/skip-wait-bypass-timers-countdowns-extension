export const EXTENSION_ENABLED_STORAGE_KEY = 'skipWaitGloballyEnabled' as const;

export async function readExtensionEnabled(): Promise<boolean> {
  const v = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  return v[EXTENSION_ENABLED_STORAGE_KEY] !== false;
}

export async function writeExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [EXTENSION_ENABLED_STORAGE_KEY]: enabled });
}

let cachedEnabled = true;

function applyActionBadge(enabled: boolean): void {
  if (typeof chrome === 'undefined' || !chrome.action?.setBadgeText) return;
  void chrome.action.setBadgeText({ text: enabled ? '' : '!' });
  if (enabled) return;
  void chrome.action.setBadgeBackgroundColor({ color: '#b91c1c' });
}

export function initExtensionEnabledCache(): void {
  void chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY).then((v) => {
    cachedEnabled = v[EXTENSION_ENABLED_STORAGE_KEY] !== false;
    applyActionBadge(cachedEnabled);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[EXTENSION_ENABLED_STORAGE_KEY]) return;
    cachedEnabled = changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false;
    applyActionBadge(cachedEnabled);
  });
}

export function isExtensionEnabledSync(): boolean {
  return cachedEnabled;
}
