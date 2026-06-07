import { Prisma, PrismaClient, TableStatus } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const closedOrderStatuses = ["PAID", "CANCELLED"] as const;
const quickOrderNotes = ["Kuryer", "Olib ketish"] as const;

export async function syncTableState(
  db: DbClient,
  tableId: string,
  restaurantId: string
) {
  const [activeOrder, activeReservation] = await Promise.all([
    db.order.findFirst({
      where: {
        tableId,
        restaurantId,
        status: { notIn: [...closedOrderStatuses] },
        OR: [{ note: null }, { note: { notIn: [...quickOrderNotes] } }],
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, status: true },
    }),
    db.reservation.findFirst({
      where: {
        tableId,
        restaurantId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { id: true },
    }),
  ]);

  const data = activeOrder
    ? {
        status: activeOrder.status === "BILL" ? TableStatus.BILL_REQUESTED : TableStatus.OCCUPIED,
        currentOrderId: activeOrder.id,
      }
    : {
        status: activeReservation ? TableStatus.RESERVED : TableStatus.FREE,
        currentOrderId: null,
      };

  return db.table.update({
    where: { id: tableId },
    data,
    select: {
      id: true,
      status: true,
      currentOrderId: true,
    },
  });
}
