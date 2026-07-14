export const LOOT_MSG_SOURCE = 'skip-wait-loot' as const;
export const MSG_INJECT_LOOT = 'INJECT_LOOT' as const;

type SwRequestInit = RequestInit & { __swOwn?: boolean };

export function runLootBootstrap(msgSource: string, earlyOnly?: boolean): void {
  type LootWin = Window & {
    __swLootHooked?: boolean;
    __swLootRunning?: boolean;
    __swLootDone?: boolean;
    conf_rew?: { cd: number; domain: string; key: string; offer?: string; link?: string };
  };
  const w = window as LootWin;

  if (!w.__swLootHooked) {
    w.__swLootHooked = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/tc') && !(init as SwRequestInit | undefined)?.__swOwn) {
        return new Response('', { status: 499 });
      }
      return origFetch(input, init);
    };
    try {
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    } catch {}
    const subtle = crypto.subtle;
    const enc = subtle.encrypt.bind(subtle);
    subtle.encrypt = async (algo, key, data) => {
      try {
        const text = new TextDecoder().decode(data);
        if (text.includes('"bot"')) {
          const obj = JSON.parse(text) as { bot?: boolean; botKind?: string };
          obj.bot = false;
          delete obj.botKind;
          data = new TextEncoder().encode(JSON.stringify(obj));
        }
      } catch {}
      return enc(algo, key, data);
    };
    try {
      location.assign = () => {};
      location.replace = () => {};
    } catch {}
  }

  if (earlyOnly) return;

  const post = (payload: { type: 'wait'; endTs: number } | { type: 'dest'; dest: string } | { type: 'err'; message: string }) => {
    window.postMessage({ source: msgSource, ...payload }, location.origin);
  };

  const pierce = async () => {
    if (w.__swLootRunning || w.__swLootDone) return;
    w.__swLootRunning = true;

    const parseTuple = (raw: string) => {
      const body = raw.trim().replace(/;$/, '');
      return Function(`"use strict"; return [${body.slice(1, -1)}];`)() as unknown[];
    };
    const parseR = (msg: string) => {
      const payload = msg.slice(2);
      if (/^https?:\/\//i.test(payload)) return payload.trim();
      const bin = atob(payload);
      const key = [...bin.slice(0, 5)].map((c) => c.charCodeAt(0));
      return [...bin.slice(5)]
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (key[i % 5] ?? 0)))
        .join('')
        .trim();
    };
    const wsHost = (urid: string) => Number(String(urid).slice(-5)) % 3;
    const lootSession = () =>
      String(
        Math.floor(9 * Math.random() + 1) +
          Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('') +
          Math.floor(Math.random() * 10),
      );
    const designId = () => {
      for (const s of document.scripts) {
        const m = s.src.match(/\/(\d+)\.js(?:\?|$)/);
        if (m) return Number(m[1]);
      }
      throw new Error('design_id not found');
    };
    const taboolaUserSync = () => {
      const k = 'taboola_user_sync';
      const existing = localStorage.getItem(k);
      if (existing) return existing;
      const next = `${crypto.randomUUID()}-tuct${Math.random().toString(16).slice(2, 10)}`;
      localStorage.setItem(k, next);
      return next;
    };
    const wait = <T>(read: () => T | null | undefined) =>
      new Promise<T>((resolve) => {
        const tick = () => {
          const v = read();
          if (v) return resolve(v);
          requestAnimationFrame(tick);
        };
        tick();
      });

    try {
      const conf = await wait(() => w.conf_rew);
      type LootDoc = Document & { session?: string; verify?: () => void; botd?: Record<string, unknown> & { encrypted?: string } };
      const doc = document as LootDoc;
      const botdRaw = await wait(() => (doc.botd?.encrypted ? doc.botd : null));
      if (!conf.cd || !conf.domain || !conf.key) throw new Error('conf_rew missing');

      const verify =
        doc.session && typeof doc.verify === 'function'
          ? Promise.resolve(doc.verify())
          : doc.session
            ? Promise.resolve(navigator.sendBeacon('/verify', JSON.stringify({ session: doc.session })))
            : Promise.resolve();
      const paramsRaw = await Promise.all([
        verify,
        fetch(`https://${conf.domain}/?tid=${conf.cd}&params_only=1`).then((r) => r.text()),
      ]).then(([, raw]) => raw);

      const tuple = parseTuple(paramsRaw);
      const tcDomain = String(tuple[10]);
      const wsBase = String(tuple[9]);
      const maxTasks = Number(tuple[6]);
      const bl = tuple[7];
      if (!tcDomain || !wsBase || !Number.isFinite(maxTasks) || maxTasks <= 0) throw new Error('cdn tuple incomplete');

      const botd = { ...botdRaw, bot: false };
      delete (botd as { botKind?: string }).botKind;
      const session = lootSession();
      const tcResp = await fetch(`https://${tcDomain}/tc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tid: conf.cd,
          bl,
          session,
          max_tasks: maxTasks,
          design_id: designId(),
          cur_url: location.href,
          doc_ref: document.referrer,
          num_of_tasks: maxTasks,
          is_loot: true,
          rkey: conf.key,
          cookie_id: String(Math.floor(1e8 + Math.random() * 9e8)),
          botd: JSON.stringify(botd),
          botds: doc.session,
          offer: conf.offer,
          ver: 'v1',
          test_unlocker_app: -1,
          allow_unlocker: true,
          desktop_design: 0,
          unlocker_only: 0,
          additional_info: {},
          taboola_user_sync: taboolaUserSync(),
          fid: Number(localStorage.getItem('fpjsidd')) || -1,
          clid: document.cookie.match(/(?:^|;\s*)uid=([^;]+)/)?.[1] ?? -1,
        }),
        __swOwn: true,
      } as SwRequestInit);
      const tcText = await tcResp.text();
      if (tcResp.status !== 200) throw new Error(`tc ${tcResp.status}`);

      type LootTask = { urid: string; task_id: number; action_pixel_url?: string; auto_complete_seconds?: number };
      const tasks = JSON.parse(tcText) as LootTask[];
      if (!tasks.length) throw new Error('tc empty');
      tasks.sort((a, b) => Number(a.auto_complete_seconds) - Number(b.auto_complete_seconds));
      for (const t of tasks) {
        if (!Number.isFinite(Number(t.auto_complete_seconds)) || Number(t.auto_complete_seconds) <= 0) {
          throw new Error('auto_complete_seconds missing');
        }
      }

      const tcAt = Date.now();
      const lead = tasks[0];
      if (!lead) throw new Error('tc empty');
      const minAutoSec = Number(lead.auto_complete_seconds);
      post({ type: 'wait', endTs: tcAt + minAutoSec * 1000 });

      await Promise.all(
        tasks.flatMap((t) => {
          const row = [
            fetch(`https://${tcDomain}/td?ac=auto_complete&urid=${t.urid}&cat=${t.task_id}&tid=${conf.cd}`),
          ];
          if (t.action_pixel_url) row.push(fetch(`https:${t.action_pixel_url}`));
          return row;
        }),
      );

      let won = false;
      const hit = await Promise.any(
        tasks.map(
          (task) =>
            new Promise<string>((resolve, reject) => {
              if (won) return reject(new Error('aborted'));
              const host = wsHost(task.urid);
              void fetch(`https://${host}.${wsBase}/st?uid=${task.urid}&cat=${task.task_id}`, { method: 'POST' });
              const ws = new WebSocket(
                `wss://${host}.${wsBase}/c?uid=${task.urid}&cat=${task.task_id}&key=${conf.key}&session_id=${session}&is_loot=1&tid=${conf.cd}`,
              );
              const done = (fn: () => void) => {
                try {
                  ws.close();
                } catch {}
                fn();
              };
              ws.onopen = () => ws.send('0');
              ws.onmessage = (ev) => {
                const msg = String(ev.data);
                if (msg === 'aaaa') return ws.send('0');
                if (!msg.startsWith('r:')) return;
                won = true;
                done(() => resolve(parseR(msg)));
              };
              ws.onerror = () => done(() => reject(new Error('ws error')));
            }),
        ),
      );

      w.__swLootDone = true;
      post({ type: 'dest', dest: hit });
      location.replace(hit);
    } catch (err) {
      w.__swLootRunning = false;
      post({ type: 'err', message: err instanceof Error ? err.message : String(err) });
    }
  };

  void pierce();
}
