/**
 * 토큰 저장소 추상화.
 *
 * 지금은 Redis가 없어서 InMemoryTokenStore(프로세스 메모리 Map)로 임시 동작한다.
 * Redis 준비되면 동일한 TokenStore 인터페이스로 RedisTokenStore만 구현해
 * plugins/auth.ts 의 주입부만 교체하면 된다. (나머지 코드는 그대로)
 *
 * ⚠️ 임시 한계: 서버 재시작 시 저장된 refresh 토큰이 전부 날아간다(재로그인 필요).
 */
export interface TokenStore {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

interface Entry {
  value: string;
  expiresAt: number; // epoch ms
}

export class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, Entry>();

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

// refresh 토큰 저장 키 규칙 (Redis 전환 후에도 동일하게 사용)
export const refreshKey = (userId: number | string) => `auth:refresh:${userId}`;
