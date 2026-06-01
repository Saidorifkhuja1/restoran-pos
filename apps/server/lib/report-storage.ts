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
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const extensions = new Set(["csv", "xlsx", "pdf"]);

function assertSafeId(id: string) {
  if (!idPattern.test(id)) throw new Error("Invalid report id");
}

async function ensureStorage() {
  await mkdir(storageRoot, { recursive: true });
}

export async function saveReportJob(job: StoredReportJob): Promise<StoredReportJob> {
  assertSafeId(job.id);
  await ensureStorage();
  await writeFile(path.join(storageRoot, `${job.id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export async function readReportJob(id: string): Promise<StoredReportJob | null> {
  try {
    assertSafeId(id);
    const raw = await readFile(path.join(storageRoot, `${id}.json`), "utf8");
    return JSON.parse(raw) as StoredReportJob;
  } catch {
    return null;
  }
}

export async function reportFilePath(id: string, extension: string): Promise<string> {
  assertSafeId(id);
  if (!extensions.has(extension)) throw new Error("Invalid report extension");
  await ensureStorage();
  return path.join(storageRoot, `${id}.${extension}`);
}
