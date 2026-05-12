import { useCallback, useEffect, useState } from 'react';
import {
  EXTENSION_ENABLED_STORAGE_KEY,
  readExtensionEnabled,
  writeExtensionEnabled,
} from '../../utils/extension-enabled';

export function ExtensionToolbarSwitch(): React.ReactElement {
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readExtensionEnabled().then((v) => {
      setEnabled(v);
      setReady(true);
    });
    const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'local' || !changes[EXTENSION_ENABLED_STORAGE_KEY]) return;
      setEnabled(changes[EXTENSION_ENABLED_STORAGE_KEY].newValue !== false);
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

  const onToggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    void writeExtensionEnabled(next);
  }, [enabled]);

  const label = !ready ? '…' : enabled ? 'On' : 'Off';

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className="font-poppins text-[11px] font-bold tracking-wide text-neutral-600 uppercase"
        aria-live="polite"
      >
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={
          ready ? (enabled ? 'Turn extension off' : 'Turn extension on') : 'Extension power'
        }
        title={ready ? (enabled ? 'Turn off everywhere' : 'Turn on everywhere') : undefined}
        disabled={!ready}
        onClick={onToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
          enabled ? 'bg-primary-600' : 'bg-neutral-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden
        />
      </button>
    </div>
  );
}
