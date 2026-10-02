import { config } from 'dotenv';

/**
 * 환경변수 읽기. **다른 import 보다 먼저** 불려야 하므로 따로 모듈로 뺐다
 * (ESM 은 import 를 전부 끌어올리기 때문에, server.ts 안에서 함수를 부르면 늦다).
 *
 * - `.env`       비밀이 아닌 공용 설정. git 에 올라간다.
 * - `.env.local` 비밀값. git 에 안 올라간다. 나중에 읽으므로 같은 이름이면 이쪽이 이긴다.
 *
 * scripts/seed.mjs 도 같은 순서로 읽는다 — 한쪽만 고치지 말 것.
 */
config({ quiet: true });
config({ path: '.env.local', override: true, quiet: true });
