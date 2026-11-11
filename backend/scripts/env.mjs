/**
 * 스크립트용 환경변수 로딩.
 *
 * 읽는 순서는 src/env.ts 와 같아야 한다 — `.env`(공용) 먼저, `.env.local`(비밀값)이 나중에
 * 덮어쓴다. 예전에는 seed.mjs 가 같은 코드를 따로 들고 있어서 한쪽만 고치면 어긋났다.
 */
import { config } from 'dotenv';

export function loadEnv() {
  config({ quiet: true });
  config({ path: '.env.local', override: true, quiet: true });
}
