import { createClient, RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL;
const globalForRedis = global as unknown as { redis?: RedisClientType };

export const redis =
  globalForRedis.redis ||
  (redisUrl
    ? createClient({
        url: redisUrl,
      })
    : null);

if (redis && !globalForRedis.redis) {
  redis.on("error", (error) => {
    console.error("[Redis Error]", error);
  });
  globalForRedis.redis = redis;
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!redis) return null;
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  if (!client) return null;
  const value = await client.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function deleteCacheByPattern(pattern: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    if (typeof key === "string") {
      await client.del(key);
    }
  }
}
