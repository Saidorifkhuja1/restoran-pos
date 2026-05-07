import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, serverError, unauthorized } from "@/lib/responses";
import { getRestaurantToken } from "@/lib/route-helpers";
import { qrSvgDataUri, receiptQrPayload } from "@/lib/receipt";
import { UserRole } from "@restopos/types";

type RouteParams = { params: Promise<{ orderId: string }> };

const roles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const params = await context.params;
    const token = await getRestaurantToken(request, roles);
    if (!token) return unauthorized("Kirish uchun login qiling");

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, restaurantId: token.restaurantId },
      select: {
        orderNumber: true,
        guestCount: true,
        createdAt: true,
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        restaurant: { select: { name: true, address: true, phone: true, receiptFooter: true, taxPercent: true } },
        items: {
          where: { status: { not: "CANCELLED" } },
          select: { name: true, price: true, quantity: true },
        },
        payment: {
          select: {
            method: true,
            subtotal: true,
            discountAmount: true,
            taxPercent: true,
            taxAmount: true,
            totalAmount: true,
            receivedAmount: true,
            changeAmount: true,
            receiptNumber: true,
            paidAt: true,
          },
        },
      },
    });
    if (!order) return notFound("Buyurtma topilmadi");

    const subtotal = order.payment?.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = order.payment?.totalAmount ?? Math.round(subtotal * (1 + order.restaurant.taxPercent / 100));
    const rows = order.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)} x${item.quantity}</td><td>${(item.price * item.quantity).toLocaleString("uz-UZ")}</td></tr>`
      )
      .join("");

    const receiptNumber = order.payment?.receiptNumber || `#${order.orderNumber.toString().padStart(4, "0")}`;
    const qrSrc = qrSvgDataUri(receiptQrPayload(receiptNumber, params.orderId));
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt</title>
<style>
body{font-family:monospace;width:80mm;margin:0;padding:8px;color:#111}
h1{font-size:18px;text-align:center;margin:0 0 6px}
p{margin:2px 0}.center{text-align:center}.line{border-top:1px dashed #111;margin:8px 0}
table{width:100%;border-collapse:collapse}td:last-child{text-align:right}.total{font-weight:700;font-size:16px}
@media print{body{width:80mm}}
</style></head><body>
<h1>${escapeHtml(order.restaurant.name)}</h1>
<p class="center">${escapeHtml(order.restaurant.address || "")}</p>
<p class="center">${escapeHtml(order.restaurant.phone || "")}</p>
<div class="line"></div>
<p>Chek: ${escapeHtml(receiptNumber)}</p>
<p>Sana: ${(order.payment?.paidAt || order.createdAt).toLocaleString("uz-UZ")}</p>
<p>Ofitsiant: ${escapeHtml(order.waiter.name)}</p>
<p>Stol: ${order.table.number} | Mehmon: ${order.guestCount}</p>
<div class="line"></div>
<table>${rows}</table>
<div class="line"></div>
<table>
<tr><td>Subtotal</td><td>${subtotal.toLocaleString("uz-UZ")}</td></tr>
<tr><td>Chegirma</td><td>${(order.payment?.discountAmount || 0).toLocaleString("uz-UZ")}</td></tr>
<tr><td>QQS ${order.payment?.taxPercent ?? order.restaurant.taxPercent}%</td><td>${(order.payment?.taxAmount || total - subtotal).toLocaleString("uz-UZ")}</td></tr>
<tr class="total"><td>Jami</td><td>${total.toLocaleString("uz-UZ")} UZS</td></tr>
</table>
<p>To'lov: ${escapeHtml(order.payment?.method || "-")}</p>
<p>Qaytim: ${(order.payment?.changeAmount || 0).toLocaleString("uz-UZ")}</p>
<div class="line"></div>
<p class="center"><img src="${qrSrc}" width="96" height="96" alt="QR"></p>
<p class="center">${escapeHtml(order.restaurant.receiptFooter || "Rahmat!")}</p>
</body></html>`;

    return new NextResponse(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("[Receipt Error]", error);
    return serverError("Chekni yaratishda xato");
  }
}
