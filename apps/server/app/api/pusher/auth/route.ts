import { NextRequest, NextResponse } from "next/server";
import { pusher, privateChannel } from "@/lib/pusher";
import { getRestaurantToken } from "@/lib/route-helpers";
import { UserRole } from "@restopos/types";

const roles = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
] as const;

export async function POST(request: NextRequest) {
  const token = await getRestaurantToken(request, roles);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!pusher) {
    return NextResponse.json({ error: "Pusher is not configured" }, { status: 503 });
  }

  const form = await request.formData();
  const socketId = form.get("socket_id");
  const channelName = form.get("channel_name");
  const allowedChannels = new Set([
    privateChannel(`restaurant:${token.restaurantId}`),
    privateChannel(`kitchen:${token.restaurantId}`),
    privateChannel(`cashier:${token.restaurantId}`),
  ]);

  if (
    typeof socketId !== "string" ||
    typeof channelName !== "string" ||
    !allowedChannels.has(channelName)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
}
