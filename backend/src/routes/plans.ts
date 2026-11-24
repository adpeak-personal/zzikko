import type { FastifyInstance } from 'fastify';
import { HttpError } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as plans from '../repositories/plans.js';
import { DNBN, fetchDnbnPlans } from '../lib/plans/dnbn.js';

/** 유심 요금제 — 공개 목록과, 운영진이 누르는 '가져오기' */
export default async function planRoutes(app: FastifyInstance) {
  app.get('/plans', async () => ({
    items: await plans.listPlans(),
    source: { name: DNBN.name, home: DNBN.home },
    syncedAt: await plans.lastSyncedAt(DNBN.source),
  }));

  /**
   * 바깥 목록을 다시 받아 덮어쓴다. 쪽마다 쉬어 가므로 14쪽이면 20초쯤 걸린다.
   * 사람이 눌렀을 때만 돈다 — 남의 서버를 주기적으로 두드리지 않는다.
   */
  app.post('/admin/plans/sync', { preHandler: requireAdmin }, async (request) => {
    let items;
    try {
      items = await fetchDnbnPlans();
    } catch (error) {
      request.log.warn({ err: error }, 'dnbn 요금제 받기 실패');
      throw new HttpError(502, `${DNBN.name} 목록을 받지 못했습니다. 잠시 뒤 다시 해 주세요.`);
    }
    // 하나도 못 읽었으면 페이지 모양이 바뀐 것 — 저장하면 전부 판매 종료로 내려간다
    if (items.length === 0) {
      throw new HttpError(502, `${DNBN.name} 목록에서 요금제를 하나도 읽지 못했습니다. 페이지 형식이 바뀌었을 수 있습니다.`);
    }
    const result = await plans.syncPlans(DNBN.source, items);
    request.log.info(result, 'dnbn 요금제 가져옴');
    return result;
  });
}
