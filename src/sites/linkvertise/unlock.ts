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

export type AccessIdentifier = {
  userIdAndUrl: { user_id: string; url: string };
};

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

const consentString = (): string => {
  const m = document.cookie.match(/(?:^|; )euconsent-v2=([^;]*)/);
  return m?.[1] ? decodeURIComponent(m[1]) : '';
};

const taskArgs = (completionToken?: string): Record<string, unknown> => {
  const args: Record<string, unknown> = {
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
  let path: string;
  try {
    path = new URL(href).pathname;
  } catch {
    return null;
  }
  const m = path.match(/^\/access\/([^/]+)\/([^/]+)\/?$/i);
  if (!m?.[1] || !m[2]) return null;
  return { userIdAndUrl: { user_id: m[1], url: decodeURIComponent(m[2]) } };
}

const getContent = (identifier: AccessIdentifier): Promise<{ getContent: Content }> =>
  gql('getContent', GET_CONTENT, { identifier, task_args: taskArgs() });

const completeTask = (
  identifier: AccessIdentifier,
  taskId: string,
  completionToken?: string,
): Promise<unknown> =>
  gql('completeTask', COMPLETE_TASK, {
    identifier,
    task_id: taskId,
    task_args: taskArgs(completionToken),
  });

const activeAd = (tasks: AccessTask[]): AccessTask | null =>
  tasks.find((t) => t.__typename === 'AdTask' && t.status !== 'DONE') ?? null;

const activeWait = (tasks: AccessTask[]): AccessTask | null =>
  tasks.find((t) => t.__typename === 'WaitTask' && t.status !== 'DONE') ?? null;

const isHttpUrl = (s: string): boolean => /^https?:\/\//i.test(s);

const destinationFromTarget = (target: TargetData): string => {
  const direct = target.url?.trim() ?? '';
  if (direct && isHttpUrl(direct)) return direct;
  const fromPaste = target.paste?.match(/https?:\/\/[^\s<>"']+/i)?.[0]?.trim() ?? '';
  if (fromPaste && isHttpUrl(fromPaste)) return fromPaste;
  throw new Error('target');
};

export async function unlockAccessDestination(
  identifier: AccessIdentifier,
  progress: UnlockProgress = {},
): Promise<string> {
  const { onStatus, onWait, onWaitDone } = progress;
  const maxSteps = 16;

  for (let step = 0; step < maxSteps; step++) {
    onStatus?.('Reading access tasks…');
    const content = (await getContent(identifier)).getContent;

    if (content.__typename === 'DetailPageTargetData') {
      return destinationFromTarget(content);
    }

    if (content.__typename !== 'ContentAccessTaskSet') throw new Error('content');

    const wait = activeWait(content.tasks);
    if (wait) {
      const sec = Math.max(0, Math.floor(Number(wait.remainingWaitingTime) || 0));
      if (sec > 0) {
        onStatus?.('Server wait required…');
        const endAt = Date.now() + sec * 1000;
        onWait?.(endAt);
        await sleep(sec * 1000);
        onWaitDone?.();
      }
      onStatus?.('Advancing wait task…');
      await completeTask(identifier, wait.id);
      continue;
    }

    const ad = activeAd(content.tasks);
    if (ad) {
      const token = ad.ads?.[0]?.completion_token?.trim() || undefined;
      onStatus?.(
        ad.adsTotal && ad.adIndex
          ? `Completing ad ${ad.adIndex} of ${ad.adsTotal}…`
          : 'Completing ad task…',
      );
      await completeTask(identifier, ad.id, token);
      continue;
    }

    throw new Error('tasks');
  }

  throw new Error('steps');
}
