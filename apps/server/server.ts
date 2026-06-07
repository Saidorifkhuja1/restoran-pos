import { createServer, IncomingMessage } from "node:http";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeMessage } from "./lib/realtime-bus";

function getCookie(request: IncomingMessage, name: string): string | null {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

async function main() {
  const dev = process.env.NODE_ENV !== "production";
  process.loadEnvFile?.(".env");
  const [{ verifyToken }, { realtimeBus }] = await Promise.all([
    import("./lib/auth"),
    import("./lib/realtime-bus"),
  ]);
  const hostname = process.env.HOSTNAME || "0.0.0.0";
  const port = Number(process.env.PORT || 3001);
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((request, response) => handle(request, response));
  const websocketServer = new WebSocketServer({ noServer: true });

  websocketServer.on("connection", (socket: WebSocket, _request: IncomingMessage, restaurantId: string) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    const listener = (message: RealtimeMessage) => {
      const channelRestaurantId = message.channel.split(":")[1];
      if (channelRestaurantId !== restaurantId || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(message));
    };

    realtimeBus.on("message", listener);
    socket.send(JSON.stringify({ channel: `restaurant:${restaurantId}`, event: "connected", payload: null }));
    socket.on("close", () => realtimeBus.off("message", listener));
  });

  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname !== "/ws") return;

    const token =
      getCookie(request, "restopos-token") ?? url.searchParams.get("token");
    const payload = token ? await verifyToken(token) : null;
    if (!payload || payload.role === "SUPERADMIN" || !("restaurantId" in payload) || !payload.restaurantId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request, payload.restaurantId);
    });
  });

  const heartbeat = setInterval(() => {
    websocketServer.clients.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30_000);

  server.listen(port, hostname, () => {
    console.log(`RestoPOS ready on http://localhost:${port}`);
  });

  function shutdown() {
    clearInterval(heartbeat);
    websocketServer.close();
    server.close(() => process.exit(0));
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[Server Startup Error]", error);
  process.exit(1);
});

declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
  }
}
