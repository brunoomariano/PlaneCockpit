export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;
  size?(): Promise<number>;
  close?(): Promise<void>;
}
