import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { initMonitoring } from "../config/monitoring.js";
import { registerChatSocket } from "../sockets/chat.socket.js";
import { logInfo } from "../utils/logger.js";
import { createApp } from "./app.js";

initMonitoring();

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL
  }
});

registerChatSocket(io);

httpServer.listen(Number(env.PORT), () => {
  logInfo("server_started", {
    port: Number(env.PORT),
    clientUrl: env.CLIENT_URL
  });
});
