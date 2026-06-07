import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound, serverError, success } from "@/lib/responses";
import { publishEvent, cashierChannel, restaurantChannel } from "@/lib/pusher";
import { deleteCacheByPattern } from "@/lib/redis";
import { zodMessage } from "@/lib/route-helpers";
import { syncTableState } from "@/lib/table-status";

const webhookSchema = z.object({
  orderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  status: z.enum(["PAID", "FAILED", "CANCELLED"]),
  amount: z.number().int().positive(),
  method: z.enum(["CARD", "QR"]).default("QR"),
});

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hmac(secret: string, payload: string, algorithm: "sha256" | "sha512" = "sha256"): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest("hex");
}

function verifyProviderSignature(request: NextRequest, payload: string): boolean {
  const provider = (request.headers.get("x-payment-provider") || "generic").toLowerCase();
  if (provider === "click") {
    const secret = process.env.CLICK_SECRET_KEY;
    const signature = request.headers.get("x-click-signature") || "";
    return Boolean(secret && signature && timingSafeEqual(signature, hmac(secret, payload)));
  }
  if (provider === "payme") {
    const secret = process.env.PAYME_SECRET_KEY;
    const authorization = request.headers.get("authorization") || "";
    const expected = `Basic ${Buffer.from(`Paycom:${secret || ""}`).toString("base64")}`;
    return Boolean(secret && timingSafeEqual(authorization, expected));
  }
  if (provider === "uzum") {
    const secret = process.env.UZUM_SECRET_KEY;
    const signature = request.headers.get("x-uzum-signature") || "";
    return Boolean(secret && signature && timingSafeEqual(signature, hmac(secret, payload, "sha512")));
  }
  if (provider === "stripe") {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const header = request.headers.get("stripe-signature") || "";
    const timestamp = header.split(",").find((part) => part.startsWith("t="))?.slice(2) || "";
    const signature = header.split(",").find((part) => part.startsWith("v1="))?.slice(3) || "";
    const expected = secret && timestamp ? hmac(secret, `${timestamp}.${payload}`) : "";
    return Boolean(secret && signature && expected && timingSafeEqual(signature, expected));
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const signature = request.headers.get("x-webhook-secret") || "";
  return Boolean(secret && signature && timingSafeEqual(signature, secret));
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyProviderSignature(request, rawBody)) {
      return forbidden("Webhook imzosi noto'g'ri");
    }

    const parsed = webhookSchema.safeParse(JSON.parse(rawBody) as unknown);
    if (!parsed.success) return badRequest(zodMessage(parsed.error));
    if (parsed.data.status !== "PAID") return success({ accepted: true });

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        restaurantId: true,
        tableId: true,
        status: true,
        payment: { select: { id: true } },
        items: { where: { status: { not: "CANCELLED" } }, select: { price: true, quantity: true } },
      },
    });
    if (!order) return notFound("Buyurtma topilmadi");
    if (order.status === "CANCELLED") return badRequest("Bekor qilingan buyurtmani to'lab bo'lmaydi");
    const provider = (request.headers.get("x-payment-provider") || "generic").toLowerCase();
    const existingProviderPayment = await prisma.payment.findFirst({
      where: {
        restaurantId: order.restaurantId,
        providerPaymentId: parsed.data.providerPaymentId,
      },
      select: { id: true, orderId: true },
    });
    if (existingProviderPayment) return success({ accepted: true, duplicate: true });
    if (order.payment) return success({ accepted: true, duplicate: true });

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = 0;
    const totalAmount = subtotal;
    if (parsed.data.amount !== totalAmount) return badRequest("To'lov summasi mos emas");

    const { payment, table } = await prisma.$transaction(async (tx) => {
      const payableOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          restaurantId: order.restaurantId,
          status: { notIn: ["PAID", "CANCELLED"] },
          payment: null,
        },
        data: { status: "PAID", paidAt: new Date() },
      });
      if (payableOrder.count === 0) {
        throw new Error("ORDER_ALREADY_PAID");
      }

      const cashier =
        (await tx.user.findFirst({
          where: { restaurantId: order.restaurantId, role: "CASHIER", isActive: true },
          select: { id: true },
        })) ??
        (await tx.user.findFirst({
          where: { restaurantId: order.restaurantId, role: "ADMIN", isActive: true },
          select: { id: true },
        }));
      if (!cashier) throw new Error("Restoranda faol kassir yoki admin topilmadi");

      const counter = await tx.restaurantCounter.upsert({
        where: { restaurantId: order.restaurantId },
        update: { receiptSeq: { increment: 1 } },
        create: { restaurantId: order.restaurantId, receiptSeq: 1 },
        select: { receiptSeq: true },
      });
      const created = await tx.payment.create({
        data: {
          restaurantId: order.restaurantId,
          orderId: order.id,
          cashierId: cashier.id,
          method: parsed.data.method,
          provider,
          providerPaymentId: parsed.data.providerPaymentId,
          subtotal,
          taxPercent: 0,
          taxAmount,
          totalAmount,
          cardAmount: totalAmount,
          receiptNumber: `#${counter.receiptSeq.toString().padStart(4, "0")}`,
        },
        select: { id: true, orderId: true, totalAmount: true, method: true, receiptNumber: true },
      });

      const tableState = await syncTableState(tx, order.tableId, order.restaurantId);
      return { payment: created, table: tableState };
    });

    await Promise.all([
      deleteCacheByPattern(`reports:${order.restaurantId}:*`),
      publishEvent(cashierChannel(order.restaurantId), "payment-done", payment),
      publishEvent(restaurantChannel(order.restaurantId), "order:updated", { orderId: order.id, status: "PAID" }),
      publishEvent(restaurantChannel(order.restaurantId), "table:status", {
        tableId: order.tableId,
        status: table.status,
        currentOrderId: table.currentOrderId,
      }),
    ]);

    return success({ accepted: true, payment });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("Webhook JSON noto'g'ri");
    if (error instanceof Error && error.message === "ORDER_ALREADY_PAID") {
      return success({ accepted: true, duplicate: true });
    }
    console.error("[Payment Webhook Error]", error);
    return serverError("Webhookni qayta ishlashda xato");
  }
}
