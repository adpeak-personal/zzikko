/**
 * 주기적인 뒷정리 — 글에 안 쓰인 이미지를 지운다.
 *
 * 이미지는 올리는 즉시 저장되므로, 에디터에 넣었다가 지우고 글을 등록하면
 * 그 파일은 아무 글에도 묶이지 않은 채 남는다. 사람이 챙기지 않으면
 * 버킷에 영원히 쌓이고, 그건 돈이 새는 쪽이다.
 *
 * 끄려면 MAINTENANCE_ENABLED=false, 주기는 MAINTENANCE_INTERVAL_HOURS 로 바꾼다.
 */
import type { FastifyInstance } from 'fastify';
import { deleteByUrls } from './storage.js';
import { deleteUploadRecords, findOrphans } from '../repositories/uploads.js';

/** 글을 쓰다 만 사람의 이미지를 지우면 안 되므로 유예를 둔다 */
const GRACE_HOURS = Number(process.env.UPLOADS_GC_GRACE_HOURS ?? 24);
const INTERVAL_HOURS = Number(process.env.MAINTENANCE_INTERVAL_HOURS ?? 6);
/** 서버가 막 떴을 때 바로 돌리지 않는다 — 기동 중 부하를 피한다 */
const FIRST_RUN_DELAY_MS = 60_000;

export interface SweepResult {
  orphans: number;
  bytes: number;
}

/** 한 바퀴 돈다 */
export async function sweep(graceHours = GRACE_HOURS): Promise<SweepResult> {
  const orphans = await findOrphans(graceHours);
  if (orphans.length === 0) return { orphans: 0, bytes: 0 };

  await deleteByUrls(orphans.flatMap((o) => o.urls));
  // 파일을 지운 뒤에 기록을 지운다 — 중간에 멈춰도 다음 번에 다시 잡힌다
  await deleteUploadRecords(orphans.map((o) => o.id));

  return { orphans: orphans.length, bytes: orphans.reduce((sum, o) => sum + o.size, 0) };
}

export function startMaintenance(app: FastifyInstance) {
  if (process.env.MAINTENANCE_ENABLED === 'false') {
    app.log.info('뒷정리 작업이 꺼져 있습니다 (MAINTENANCE_ENABLED=false)');
    return;
  }

  const run = async () => {
    try {
      const r = await sweep();
      // 할 일이 없었으면 로그를 남기지 않는다 — 몇 시간마다 빈 줄이 쌓일 이유가 없다
      if (r.orphans > 0) {
        app.log.info({ ...r, kb: Math.round(r.bytes / 1024) }, '안 쓰인 이미지 정리');
      }
    } catch (err) {
      app.log.error({ err }, '뒷정리 실패');
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

  app.log.info(`뒷정리 작업 등록 — ${INTERVAL_HOURS}시간마다 (유예 ${GRACE_HOURS}시간)`);
}
