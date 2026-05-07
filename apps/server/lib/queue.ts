import { Queue, Worker, JobsOptions } from "bullmq";
import type { RedisOptions } from "ioredis";

export type ReportJobData = {
  exportId: string;
  restaurantId: string;
  requestedBy: string;
  from: string;
  to: string;
  format: "csv" | "xlsx" | "pdf";
};

const redisUrl = process.env.REDIS_URL;

function connection(): RedisOptions {
  if (!redisUrl) {
    return { host: "127.0.0.1", port: 6379 };
  }
  return { lazyConnect: true, ...parseRedisUrl(redisUrl) };
}

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
  };
}

let reportQueue: Queue<ReportJobData> | null = null;

function getReportQueue(): Queue<ReportJobData> {
  if (!redisUrl) {
    throw new Error("REDIS_URL sozlanmagan");
  }
  reportQueue ??= new Queue<ReportJobData>("reports", {
    connection: connection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
  return reportQueue;
}

export async function enqueueReport(
  data: ReportJobData,
  options?: JobsOptions
) {
  return getReportQueue().add("export", data, options);
}

export function createReportWorker(
  processor: (data: ReportJobData) => Promise<void>
) {
  if (!redisUrl) {
    throw new Error("REDIS_URL sozlanmagan");
  }
  return new Worker<ReportJobData>(
    "reports",
    async (job) => processor(job.data),
    { connection: connection() }
  );
}
