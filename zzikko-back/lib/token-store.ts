export interface TokenStore {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

interface Entry {
  value: string;
  expiresAt: number;
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

export const refreshKey = (userId: number | string) => `auth:refresh:${userId}`;
