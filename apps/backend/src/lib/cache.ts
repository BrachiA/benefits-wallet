// Interface-first: כשה-traffic יצדיק Redis, מחליפים את המימוש
// היחיד הזה בלי לגעת בקוד שצורך אותו (Service layer).
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

type CacheEntry = { value: unknown; expiresAt: number | null };

class InMemoryCacheProvider implements CacheProvider {
  private store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// מועמדים ראשונים לשימוש: רשימת Program ו-Category — כמעט לא
// משתנים אך נקראים בכל מסך.
export const cache: CacheProvider = new InMemoryCacheProvider();
