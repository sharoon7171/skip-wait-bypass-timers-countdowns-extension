const GQL = 'https://publisher.linkvertise.com/graphql';

const GET_CONTENT = `query getContent($identifier: PublicLinkIdentificationInput!, $task_args: TaskArgument) {
  getContent(input: $identifier, task_args: $task_args) {
    ... on ContentAccessTaskSet {
      __typename
      tasks {
        __typename
        id
        ... on WaitTask { remainingWaitingTime status adsTotal }
        ... on AdTask { status adIndex adsTotal ads { completion_token } }
        ... on PremiumTask { status }
      }
    }
    ... on DetailPageTargetData { __typename type url paste }
    __typename
  }
}`;

const COMPLETE_TASK = `mutation completeTask($identifier: PublicLinkIdentificationInput!, $task_id: String!, $task_args: TaskArgument) {
  completeTask(input: $identifier, task_id: $task_id, task_args: $task_args) {
    id
    __typename
    ... on WaitTask { status remainingWaitingTime adsTotal }
    ... on AdTask { status adIndex adsTotal }
    ... on PremiumTask { status }
  }
}`;

type UserIdAndHash = {
  user_id: string;
  hash: string;
  originates_from_adfly: boolean;
  version?: string;
};

export type AccessIdentifier =
  | { userIdAndUrl: { user_id: string; url: string } }
  | { userIdAndHash: UserIdAndHash };

type AdOffer = { completion_token?: string | null };
type AccessTask = {
  __typename: string;
  id: string;
  status?: string;
  remainingWaitingTime?: number | null;
  adIndex?: number | null;
  adsTotal?: number | null;
  ads?: AdOffer[] | null;
};

type ContentAccess = {
  __typename: 'ContentAccessTaskSet';
  tasks: AccessTask[];
};

type TargetData = {
  __typename: 'DetailPageTargetData';
  type: string;
  url: string | null;
  paste: string | null;
};

type Content = ContentAccess | TargetData;

type GqlPayload<T> = { data?: T; errors?: Array<{ message: string }> };

export type UnlockProgress = {
  onStatus?: (text: string) => void;
  onWait?: (endAt: number) => void;
  onWaitDone?: () => void;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const actionId = (): string => {
  let id = '';
  for (let i = 0; i < 3; i++) id += crypto.randomUUID();
  return id.slice(0, 100);
};

const requestId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const consentString = (): string => {
  const m = document.cookie.match(/(?:^|; )euconsent-v2=([^;]*)/);
  return m?.[1] ? decodeURIComponent(m[1]) : '';
};

async function gql<T>(
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GQL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ operationName, query, variables }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status}`);
  const body = (await res.json()) as GqlPayload<T>;
  if (body.errors?.length) throw new Error(body.errors[0]?.message || 'graphql error');
  if (!body.data) throw new Error('graphql empty');
  return body.data;
}

export function parseAccessIdentifier(href = location.href): AccessIdentifier | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const path = url.pathname;
  const dynamic = path.match(/^\/access\/([^/]+)\/([^/]+)\/dynamic\/?$/i);
  if (dynamic?.[1]) {
    const hash = url.searchParams.get('r')?.trim() ?? '';
    if (!hash) return null;
    const userIdAndHash: UserIdAndHash = {
      user_id: dynamic[1],
      hash,
      originates_from_adfly: url.searchParams.get('link_origin') === 'adfly',
    };
    const version = url.searchParams.get('v')?.trim();
    if (version) userIdAndHash.version = version;
    return { userIdAndHash };
  }
  const classic = path.match(/^\/access\/([^/]+)\/([^/]+)\/?$/i);
  if (!classic?.[1] || !classic[2]) return null;
  return { userIdAndUrl: { user_id: classic[1], url: decodeURIComponent(classic[2]) } };
}

const activeAd = (tasks: AccessTask[]): AccessTask | null =>
  tasks.find((t) => t.__typename === 'AdTask' && t.status !== 'DONE') ?? null;

const activeWait = (tasks: AccessTask[]): AccessTask | null =>
  tasks.find((t) => t.__typename === 'WaitTask' && t.status !== 'DONE') ?? null;

const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

type SuccessHistoryState = {
  target?: TargetData | null;
  targetType?: string | null;
  linkId?: string | null;
};

export type SuccessTarget =
  | { kind: 'url'; url: string }
  | { kind: 'paste'; text: string };

export const isYourTargetPath = (pathname = location.pathname): boolean =>
  /^\/your-target\/?$/i.test(pathname);

const resolveTarget = (target: TargetData): SuccessTarget => {
  const direct = target.url?.trim() ?? '';
  if (direct && isHttpUrl(direct)) return { kind: 'url', url: direct };

  const paste = target.paste?.trim() ?? '';
  if (paste) {
    const fromPaste = paste.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.trim() ?? '';
    if (fromPaste && isHttpUrl(fromPaste)) return { kind: 'url', url: fromPaste };
    return { kind: 'paste', text: paste };
  }

  throw new Error('target');
};

export function readSuccessTarget(state: unknown = history.state): SuccessTarget | null {
  const st = state as SuccessHistoryState | null;
  if (!st?.target || typeof st.target !== 'object') return null;
  if (!isYourTargetPath() && !(st.targetType && st.linkId)) return null;
  try {
    return resolveTarget(st.target);
  } catch {
    return null;
  }
}

export function destinationFromSuccessState(state: unknown = history.state): string | null {
  const ready = readSuccessTarget(state);
  return ready?.kind === 'url' ? ready.url : null;
}

export async function unlockAccessDestination(
  identifier: AccessIdentifier,
  progress: UnlockProgress = {},
): Promise<SuccessTarget> {
  const { onStatus, onWait, onWaitDone } = progress;
  const maxSteps = 24;
  const sessionRequestId = requestId();

  const taskArgs = (completionToken?: string): Record<string, unknown> => {
    const args: Record<string, unknown> = {
      request_id: sessionRequestId,
      action_id: actionId(),
      additional_data: {
        taboola: {
          user_id: 'fallbackUserId',
          consent_string: consentString(),
          url: location.href,
          external_referrer: document.referrer || '',
          session_id: null,
        },
      },
    };
    if (completionToken) args['completion_token'] = completionToken;
    return args;
  };

  const getContent = (): Promise<{ getContent: Content }> =>
    gql('getContent', GET_CONTENT, { identifier, task_args: taskArgs() });

  const completeTask = (taskId: string, completionToken?: string): Promise<unknown> =>
    gql('completeTask', COMPLETE_TASK, {
      identifier,
      task_id: taskId,
      task_args: taskArgs(completionToken),
    });

  for (let step = 0; step < maxSteps; step++) {
    const ready = readSuccessTarget();
    if (ready) return ready;
    if (isYourTargetPath()) {
      onStatus?.('Almost there…');
      await sleep(300);
      const fromState = readSuccessTarget();
      if (fromState) return fromState;
    }

    onStatus?.('Unlocking your link…');
    const content = (await getContent()).getContent;

    if (content.__typename === 'DetailPageTargetData') {
      return resolveTarget(content);
    }

    if (content.__typename !== 'ContentAccessTaskSet') throw new Error('content');

    const readyMid = readSuccessTarget();
    if (readyMid) return readyMid;

    const wait = activeWait(content.tasks);
    if (wait) {
      const sec = Math.max(0, Math.floor(Number(wait.remainingWaitingTime) || 0));
      if (sec > 0) {
        onStatus?.('Waiting a moment…');
        const endAt = Date.now() + sec * 1000;
        onWait?.(endAt);
        await sleep(sec * 1000);
        onWaitDone?.();
      }
      const readyAfterWait = readSuccessTarget();
      if (readyAfterWait) return readyAfterWait;
      if (isYourTargetPath()) continue;
      onStatus?.('Continuing…');
      await completeTask(wait.id);
      continue;
    }

    const ad = activeAd(content.tasks);
    if (ad) {
      const readyAfterTasks = readSuccessTarget();
      if (readyAfterTasks) return readyAfterTasks;
      if (isYourTargetPath()) continue;
      const token = ad.ads?.[0]?.completion_token?.trim() || undefined;
      onStatus?.(
        ad.adsTotal && ad.adIndex
          ? `Step ${ad.adIndex} of ${ad.adsTotal}…`
          : 'Continuing…',
      );
      await completeTask(ad.id, token);
      continue;
    }

    onStatus?.('Almost there…');
    await sleep(500);
  }

  const finalReady = readSuccessTarget();
  if (finalReady) return finalReady;
  throw new Error('steps');
}
