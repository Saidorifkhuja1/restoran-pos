import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

export type ReportFormat = "csv" | "xlsx" | "pdf";
export type ReportCell = string | number | Date;
export type ReportRow = ReportCell[];

export type GeneratedReport = {
  buffer: Buffer;
  mimeType: string;
  extension: ReportFormat;
};

function csvCell(value: string | number | Date | null): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

async function reportRows(restaurantId: string, from: Date, to: Date): Promise<ReportRow[]> {
  const payments = await prisma.payment.findMany({
    where: { restaurantId, paidAt: { gte: from, lte: to } },
    select: {
      receiptNumber: true,
      method: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      paidAt: true,
      cashier: { select: { name: true } },
      order: { select: { orderNumber: true, table: { select: { number: true } } } },
    },
    orderBy: { paidAt: "desc" },
  });

  return [
    ["receipt", "order", "table", "cashier", "method", "subtotal", "discount", "tax", "total", "paidAt"],
    ...payments.map((payment) => [
      payment.receiptNumber || "",
      payment.order.orderNumber,
      payment.order.table.number,
      payment.cashier.name,
      payment.method,
      payment.subtotal,
      payment.discountAmount,
      payment.taxAmount,
      payment.totalAmount,
      payment.paidAt,
    ]),
  ];
}

async function pdfBuffer(rows: ReportRow[]): Promise<Buffer> {
  const document = new PDFDocument({ margin: 36, size: "A4" });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
  });

  document.fontSize(18).text("RestoPOS Report");
  document.moveDown();
  rows.slice(1).forEach((row) => {
    document.fontSize(9).text(
      `${row[0]} | Order ${row[1]} | Table ${row[2]} | ${row[3]} | ${row[4]} | ${Number(row[8]).toLocaleString("uz-UZ")} UZS | ${row[9] instanceof Date ? row[9].toISOString() : row[9]}`
    );
  });
  document.end();
  return done;
}

export async function generateReportExport(
  restaurantId: string,
  from: Date,
  to: Date,
  format: ReportFormat
): Promise<GeneratedReport> {
  const rows = await reportRows(restaurantId, from, to);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 16;
    });
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      buffer,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }

  if (format === "pdf") {
    return {
      buffer: await pdfBuffer(rows),
      mimeType: "application/pdf",
      extension: "pdf",
    };
  }

  return {
    buffer: Buffer.from(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "utf8"),
    mimeType: "text/csv; charset=utf-8",
    extension: "csv",
  };
}
