import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis: Redis | null =
  globalForRedis.redis ??
  (redisUrl ? new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true }) : null);

if (redis && !globalForRedis.redis) {
  redis.on("error", (error) => {
    console.error("[Redis Error]", error.message);
  });
  globalForRedis.redis = redis;
}

export async function getRedis(): Promise<Redis | null> {
  if (!redis) return null;
  if (redis.status === "wait") {
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
  await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function deleteCacheByPattern(pattern: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  let cursor = "0";
  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } while (cursor !== "0");
}
