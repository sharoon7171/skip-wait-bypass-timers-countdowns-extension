export const EXTENSION_ENABLED_STORAGE_KEY = 'skipWaitGloballyEnabled' as const;

const CONTENT_SCRIPT_ID = 'skip-wait-content';

const CONTENT_SCRIPT: chrome.scripting.RegisteredContentScript = {
  id: CONTENT_SCRIPT_ID,
  js: ['content.js'],
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
};

let activateExtension: (() => void) | null = null;

export async function readExtensionEnabled(): Promise<boolean> {
  const v = await chrome.storage.local.get(EXTENSION_ENABLED_STORAGE_KEY);
  return v[EXTENSION_ENABLED_STORAGE_KEY] !== false;
}

export async function writeExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [EXTENSION_ENABLED_STORAGE_KEY]: enabled });
}

function applyActionBadge(enabled: boolean): void {
  if (typeof chrome === 'undefined' || !chrome.action?.setBadgeText) return;
  void chrome.action.setBadgeText({ text: enabled ? '' : '!' });
  if (enabled) return;
  void chrome.action.setBadgeBackgroundColor({ color: '#b91c1c' });
}

async function syncContentScriptRegistration(enabled: boolean): Promise<void> {
  if (!chrome.scripting?.getRegisteredContentScripts) return;
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (enabled && registered.length === 0) {
    await chrome.scripting.registerContentScripts([CONTENT_SCRIPT]);
    return;
  }
  if (!enabled && registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  }
}

function applyExtensionEnabled(enabled: boolean, fromToggle: boolean): void {
  applyActionBadge(enabled);
  void syncContentScriptRegistration(enabled);
  if (enabled) {
    activateExtension?.();
    return;
  }
  if (fromToggle) chrome.runtime.reload();
}

export function setExtensionEnabledActivator(activate: () => void): void {
  activateExtension = activate;
}

export function initExtensionEnabledCache(): void {
  void readExtensionEnabled().then((enabled) => applyExtensionEnabled(enabled, false));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[EXTENSION_ENABLED_STORAGE_KEY]) return;
    applyExtensionEnabled(changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false, true);
  });
}

export function watchExtensionEnabledToggleReload(): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[EXTENSION_ENABLED_STORAGE_KEY]) return;
    if (window !== window.top) return;
    location.reload();
  });
}
