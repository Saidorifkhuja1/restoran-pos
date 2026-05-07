import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredReportJob = {
  id: string;
  restaurantId: string;
  requestedBy: string;
  from: string;
  to: string;
  format: "csv" | "xlsx" | "pdf";
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileName?: string;
  mimeType?: string;
  filePath?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
};

const storageRoot = path.join(process.cwd(), ".data", "report-exports");

async function ensureStorage() {
  await mkdir(storageRoot, { recursive: true });
}

export async function saveReportJob(job: StoredReportJob): Promise<StoredReportJob> {
  await ensureStorage();
  await writeFile(path.join(storageRoot, `${job.id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export async function readReportJob(id: string): Promise<StoredReportJob | null> {
  try {
    const raw = await readFile(path.join(storageRoot, `${id}.json`), "utf8");
    return JSON.parse(raw) as StoredReportJob;
  } catch {
    return null;
  }
}

export async function reportFilePath(id: string, extension: string): Promise<string> {
  await ensureStorage();
  return path.join(storageRoot, `${id}.${extension}`);
}
