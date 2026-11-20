/**
 * 뉴스 수집 한 바퀴 — 어드민 버튼과 자동 수집이 **같은 함수**를 쓴다.
 *
 * 둘로 나눠 두면 한쪽만 고쳐져 어긋난다. 실제로 번역을 라우트에만 붙였다가
 * 자동 수집에서 빠질 뻔했다.
 *
 * ⚠️ **자동으로 기사를 쓰지는 않는다.** 받아만 두고, 어떤 걸 기사로 만들지는 사람이 고른다.
 *    퍼온 글은 한 번 읽고 내보낸다는 원칙이 그대로다.
 */
import type { FastifyInstance } from 'fastify';
import * as feed from '../../repositories/newsFeed.js';
import { SOURCES, fetchSource } from './feed.js';
import { translateTitles } from './translate.js';

/** 밀린 번역을 한 번에 끝내려고 여러 바퀴 돈다. 무한정 돌지 않게 막아 둔다. */
const MAX_TRANSLATE_ROUNDS = 8;

const AUTO_ENABLED = process.env.NEWS_AUTO_COLLECT !== 'false';
/**
 * 자동 수집 주기.
 *
 * GSMArena RSS 는 최신 20건만 들고 있고 하루치쯤 된다 — **하루를 넘기면 그 사이 기사는
 * 피드에서 밀려 나가 영영 못 받는다.** 6시간이면 네 배쯤 여유가 있다.
 */
const INTERVAL_HOURS = Number(process.env.NEWS_COLLECT_INTERVAL_HOURS ?? 6);
/** 서버가 막 떴을 때 바로 돌리지 않는다 */
const FIRST_RUN_DELAY_MS = 90_000;

export interface CollectResult {
  added: number;
  translated: number;
  failed: string[];
  /** 번역에 쓴 토큰 — 부르는 쪽에서 비용 로그를 남긴다 */
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

export async function collectNews(warn: (message: string) => void): Promise<CollectResult> {
  const failed: string[] = [];
  let added = 0;

  for (const source of SOURCES) {
    try {
      added += (await feed.saveItems(await fetchSource(source), source.name)).length;
    } catch (err) {
      warn(`뉴스 수집 실패 — ${source.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed.push(source.name);
    }
  }

  /*
   * 제목을 한국어로 옮긴다. 방금 담은 것뿐 아니라 **아직 안 옮긴 것까지** 한다.
   *
   * listUntranslated 는 최신순 일부만 주므로, 밀린 양이 많으면 한 바퀴로 안 끝난다.
   * 빌 때까지 돌리되 한 바퀴에서 한 건도 못 옮기면 그만둔다 — 다음 바퀴도 같은 결과다.
   */
  const usage = { input_tokens: 0, output_tokens: 0 };
  let translated = 0;
  let model = '';

  for (let round = 0; round < MAX_TRANSLATE_ROUNDS; round++) {
    const pending = await feed.listUntranslated();
    if (pending.length === 0) break;

    const result = await translateTitles(
      pending.map((item) => item.title),
      warn,
    );
    usage.input_tokens += result.usage.input_tokens;
    usage.output_tokens += result.usage.output_tokens;
    model = result.model;

    let wrote = 0;
    for (const [index, item] of pending.entries()) {
      const title = result.titles[index];
      // 못 옮긴 건 적지 않는다 — 적어 두면 다음에 다시 시도하지 못한다
      if (title && title !== item.title) {
        await feed.setTitleKo(item.id, title);
        wrote += 1;
      }
    }
    translated += wrote;
    if (wrote === 0) break;
  }

  // 원문은 기사를 쓸 때만 쓰므로 오래된 건 비워 둔다 (행은 남겨야 또 안 받는다)
  await feed.trimOldSources();

  return { added, translated, failed, usage, model };
}

/**
 * 자동 수집 등록.
 *
 * RSS 가 하루치만 들고 있어서, 사람이 버튼을 안 누르면 그 사이 기사가 영영 사라진다.
 * 받아 두기만 하는 일이라 자동으로 돌려도 위험하지 않다 — 발행은 여전히 사람이 한다.
 *
 * 끄려면 NEWS_AUTO_COLLECT=false.
 */
export function startNewsCollector(app: FastifyInstance) {
  if (!AUTO_ENABLED) {
    app.log.info('뉴스 자동 수집이 꺼져 있습니다 (NEWS_AUTO_COLLECT=false)');
    return;
  }

  const run = async () => {
    try {
      const result = await collectNews((message) => app.log.warn(message));
      // 받은 것도 옮긴 것도 없으면 로그를 남기지 않는다 — 몇 시간마다 빈 줄이 쌓일 이유가 없다
      if (result.added > 0 || result.translated > 0) {
        app.log.info(
          { added: result.added, translated: result.translated, failed: result.failed },
          '뉴스 자동 수집',
        );
      }
    } catch (err) {
      app.log.error({ err }, '뉴스 자동 수집 실패');
    }
  };

  const first = setTimeout(() => void run(), FIRST_RUN_DELAY_MS);
  const repeat = setInterval(() => void run(), INTERVAL_HOURS * 60 * 60 * 1000);
  // 서버가 내려갈 때 타이머가 프로세스를 붙잡지 않게
  first.unref();
  repeat.unref();

  app.addHook('onClose', async () => {
    clearTimeout(first);
    clearInterval(repeat);
  });

  app.log.info(`뉴스 자동 수집 등록 — ${INTERVAL_HOURS}시간마다`);
}
