import { isExtensionEnabledSync } from '../utils/extension-enabled';
import {
  runShortxFetchChain,
  SHORTX_CHECK_UNLOCK,
  SHORTX_FETCH_CHAIN,
  SHORTX_USER_AGENT,
  shortxResultKey,
  type ShortxFetchResult,
} from '../shared/shortx-fetch-chain';

const inflight = new Map<string, Promise<ShortxFetchResult>>();
const completed = new Map<string, ShortxFetchResult>();

function storeResult(startUrl: string, result: ShortxFetchResult): void {
  if (result.ok) completed.set(startUrl, result);
  void chrome.storage.local.set({ [shortxResultKey(startUrl)]: result });
}

function startJob(startUrl: string): Promise<ShortxFetchResult> {
  const existing = inflight.get(startUrl);
  if (existing) return existing;
  const job = runShortxFetchChain(startUrl)
    .then((result) => {
      storeResult(startUrl, result);
      return result;
    })
    .finally(() => {
      inflight.delete(startUrl);
    });
  inflight.set(startUrl, job);
  return job;
}

export function initShortxlinksFetchChain(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === SHORTX_CHECK_UNLOCK) {
      const tokenUrl = typeof message.tokenUrl === 'string' ? message.tokenUrl : '';
      if (!tokenUrl) {
        sendResponse({ unlocked: false });
        return false;
      }
      void fetch(tokenUrl, {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'text/html,*/*', 'User-Agent': SHORTX_USER_AGENT },
      })
        .then((resp) => resp.text())
        .then((html) => sendResponse({ unlocked: !html.includes('Too Early') }))
        .catch(() => sendResponse({ unlocked: false }));
      return true;
    }
    if (message?.type !== SHORTX_FETCH_CHAIN) return false;
    if (!isExtensionEnabledSync()) {
      sendResponse({ ok: false, error: 'extension disabled' } satisfies ShortxFetchResult);
      return false;
    }
    const startUrl = typeof message.startUrl === 'string' ? message.startUrl : '';
    if (!startUrl) {
      sendResponse({ ok: false, error: 'missing start url' } satisfies ShortxFetchResult);
      return false;
    }
    const cached = completed.get(startUrl);
    if (cached) storeResult(startUrl, cached);
    else void startJob(startUrl);
    sendResponse({ ok: true, pending: true });
    return false;
  });
}
