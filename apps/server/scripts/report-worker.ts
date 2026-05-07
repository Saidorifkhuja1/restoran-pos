import { writeFile } from "node:fs/promises";
import { createReportWorker } from "@/lib/queue";
import { generateReportExport } from "@/lib/report-export";
import { readReportJob, reportFilePath, saveReportJob } from "@/lib/report-storage";

const worker = createReportWorker(async (data) => {
  const existing = await readReportJob(data.exportId);
  if (!existing) {
    throw new Error(`Report job ${data.exportId} topilmadi`);
  }

  await saveReportJob({ ...existing, status: "PROCESSING" });

  try {
    const report = await generateReportExport(
      data.restaurantId,
      new Date(data.from),
      new Date(data.to),
      data.format
    );
    const fileName = `restopos-report-${data.exportId}.${report.extension}`;
    const filePath = await reportFilePath(data.exportId, report.extension);
    await writeFile(filePath, report.buffer);
    await saveReportJob({
      ...existing,
      status: "COMPLETED",
      fileName,
      filePath,
      mimeType: report.mimeType,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await saveReportJob({
      ...existing,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown error",
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
});

worker.on("completed", (job) => {
  console.log(`[report-worker] completed ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[report-worker] failed ${job?.id}`, error);
});
