import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379/0", {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

try {
  await redis.connect();
  const heartbeat = await redis.get("newsradar:worker:heartbeat");
  process.exitCode = heartbeat ? 0 : 1;
} catch {
  process.exitCode = 1;
} finally {
  redis.disconnect();
}
