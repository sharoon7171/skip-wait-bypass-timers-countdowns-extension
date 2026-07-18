export const MSG_FCLC_LINKS_GO = 'FCLC_LINKS_GO' as const;

export type FclcLinksGoRequest = {
  type: typeof MSG_FCLC_LINKS_GO;
  action: string;
  fields: Record<string, string>;
  referer: string;
};

export type FclcLinksGoResponse = {
  url: string | null;
  message: string;
};

const isHttpUrl = (href: string): boolean => /^https?:\/\//i.test(href);

async function postLinksGo(
  action: string,
  fields: Record<string, string>,
  referer: string,
): Promise<FclcLinksGoResponse> {
  try {
    const r = await fetch(action, {
      method: 'POST',
      body: new URLSearchParams(fields),
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: referer,
      },
    });
    const data = JSON.parse(await r.text()) as { status?: string; url?: string; message?: string };
    const url = typeof data.url === 'string' ? data.url.trim() : '';
    if (data.status === 'success' && url && isHttpUrl(url)) return { url, message: '' };
    return { url: null, message: data.message || data.status || 'unlock failed' };
  } catch {
    return { url: null, message: 'network error' };
  }
}

export function initFclcLinksGo(): void {
  chrome.runtime.onMessage.addListener((msg: Partial<FclcLinksGoRequest>, _sender, sendResponse) => {
    if (msg?.type !== MSG_FCLC_LINKS_GO) return false;
    const action = typeof msg.action === 'string' ? msg.action : '';
    const referer = typeof msg.referer === 'string' ? msg.referer : '';
    const fields = msg.fields && typeof msg.fields === 'object' ? msg.fields : null;
    if (!action || !fields || !isHttpUrl(action)) {
      sendResponse({ url: null, message: 'invalid request' } satisfies FclcLinksGoResponse);
      return false;
    }
    void postLinksGo(action, fields, referer).then(sendResponse);
    return true;
  });
}

export function requestFclcLinksGo(
  action: string,
  fields: Record<string, string>,
  referer: string,
): Promise<FclcLinksGoResponse> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: MSG_FCLC_LINKS_GO, action, fields, referer } satisfies FclcLinksGoRequest,
        (resp: FclcLinksGoResponse | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ url: null, message: chrome.runtime.lastError.message || 'network error' });
            return;
          }
          resolve(resp ?? { url: null, message: 'network error' });
        },
      );
    } catch {
      resolve({ url: null, message: 'network error' });
    }
  });
}
